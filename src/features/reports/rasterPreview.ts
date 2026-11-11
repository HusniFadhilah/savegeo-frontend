import type { AoiState } from "@/features/carbon/types";

const TILE_REQUEST_CONCURRENCY = 2;
const TILE_REQUEST_ATTEMPTS = 3;

function retryDelay(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryAt = Number.isFinite(seconds)
      ? Date.now() + Math.max(0, seconds) * 1000
      : Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.min(30_000, Math.max(0, retryAt - Date.now()));
  }
  return Math.min(8_000, 750 * 2 ** attempt) + Math.random() * 250;
}

async function fetchTile(url: string): Promise<Blob> {
  let lastStatus: number | null = null;
  for (let attempt = 0; attempt < TILE_REQUEST_ATTEMPTS; attempt++) {
    let response: Response | null = null;
    try {
      response = await fetch(url, {
        credentials: "same-origin",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return await response.blob();
      lastStatus = response.status;
      const retryable = response.status === 429 || [500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt + 1 === TILE_REQUEST_ATTEMPTS) break;
    } catch (error) {
      if (attempt + 1 === TILE_REQUEST_ATTEMPTS) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
  }

  if (lastStatus === 429) {
    throw new Error("Earth Engine sedang membatasi permintaan tile (429). PDF sudah mencoba ulang otomatis; tunggu sebentar lalu unduh PDF kembali. Analisis tidak perlu dijalankan ulang.");
  }
  if (lastStatus !== null) {
    throw new Error(`Tile peta PDF gagal (${lastStatus}). Jika tautan peta sudah kedaluwarsa, jalankan ulang analisis untuk memperbaruinya.`);
  }
  throw new Error("Tile peta PDF gagal dimuat setelah dicoba ulang.");
}

/** Compose the result tiles themselves; no screenshot of an unrelated visible map. */
export async function renderRasterPreview(url: string, aoi: AoiState): Promise<string> {
  const geometry = aoi.feature?.geometry;
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon"))
    throw new Error("Batas AOI diperlukan untuk peta PDF.");
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
  const project = (point: number[]) => {
    const latitude = (Math.max(-85, Math.min(85, point[1])) * Math.PI) / 180;
    return [
      (point[0] + 180) / 360,
      (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2,
    ];
  };
  const projected = rings.map((ring) => ring.map(project));
  const [west, north, east, south] = projected
    .flat()
    .reduce(
      (b, p) => [
        Math.min(b[0], p[0]),
        Math.min(b[1], p[1]),
        Math.max(b[2], p[0]),
        Math.max(b[3], p[1]),
      ],
      [Infinity, Infinity, -Infinity, -Infinity],
    );
  if (![west, north, east, south].every(Number.isFinite) || east <= west || south <= north)
    throw new Error("Batas AOI tidak valid untuk peta PDF.");
  const width = 768,
    height = 480;
  const zoom = Math.max(
    0,
    Math.min(
      16,
      // The PDF image is 768 px wide; one lower zoom reduces Earth Engine
      // tile requests substantially while retaining enough print detail.
      Math.floor(
        Math.log2(Math.min((width - 32) / (east - west), (height - 32) / (south - north)) / 256),
      ) - 1,
    ),
  );
  const world = 256 * 2 ** zoom;
  const originX = ((west + east) / 2) * world - width / 2;
  const originY = ((north + south) / 2) * world - height / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas peta PDF tidak tersedia.");
  context.fillStyle = "#edf1f4";
  context.fillRect(0, 0, width, height);
  const tasks: (() => Promise<void>)[] = [];
  let loaded = 0;
  for (let x = Math.floor(originX / 256); x <= Math.floor((originX + width) / 256); x++) {
    for (let y = Math.floor(originY / 256); y <= Math.floor((originY + height) / 256); y++) {
      if (x < 0 || x >= 2 ** zoom || y < 0 || y >= 2 ** zoom) continue;
      tasks.push(async () => {
        const tile = await fetchTile(
          url
            .replace("{z}", String(zoom))
            .replace("{x}", String((x + 2 ** zoom) % 2 ** zoom))
            .replace("{y}", String(y)),
        );
        const bitmap = await createImageBitmap(tile);
        context.drawImage(bitmap, x * 256 - originX, y * 256 - originY, 256, 256);
        bitmap.close();
        loaded++;
      });
    }
  }
  // Bound simultaneous tile requests; a missing tile must not produce a misleading partial map.
  for (let offset = 0; offset < tasks.length; offset += TILE_REQUEST_CONCURRENCY)
    await Promise.all(tasks.slice(offset, offset + TILE_REQUEST_CONCURRENCY).map((task) => task()));
  if (!loaded) throw new Error("Raster hasil tidak tersedia untuk PDF.");
  context.strokeStyle = "#153e2b";
  context.lineWidth = 2;
  for (const ring of projected) {
    context.beginPath();
    ring.forEach((p, i) => {
      if (i === 0) context.moveTo(p[0] * world - originX, p[1] * world - originY);
      else context.lineTo(p[0] * world - originX, p[1] * world - originY);
    });
    context.closePath();
    context.stroke();
  }
  context.fillStyle = "#172e25";
  context.font = "bold 16px sans-serif";
  context.fillText("N ↑", width - 45, 28);
  return canvas.toDataURL("image/png");
}
