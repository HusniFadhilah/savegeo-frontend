import type { AoiState } from "@/features/carbon/types";

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
      Math.floor(
        Math.log2(Math.min((width - 32) / (east - west), (height - 32) / (south - north)) / 256),
      ),
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
        const response = await fetch(
          url
            .replace("{z}", String(zoom))
            .replace("{x}", String((x + 2 ** zoom) % 2 ** zoom))
            .replace("{y}", String(y)),
          { credentials: "same-origin", signal: AbortSignal.timeout(20000) },
        );
        if (!response.ok)
          throw new Error(
            `Tile peta PDF gagal (${response.status}). Jalankan ulang analisis untuk memperbarui peta.`,
          );
        const bitmap = await createImageBitmap(await response.blob());
        context.drawImage(bitmap, x * 256 - originX, y * 256 - originY, 256, 256);
        bitmap.close();
        loaded++;
      });
    }
  }
  // Bound simultaneous tile requests; a missing tile must not produce a misleading partial map.
  for (let offset = 0; offset < tasks.length; offset += 4)
    await Promise.all(tasks.slice(offset, offset + 4).map((task) => task()));
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
