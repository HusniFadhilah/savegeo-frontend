import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import "./MapExportControl.css";

type ExportAction = "png" | "geotiff" | "geojson" | "csv" | "json" | "print";

interface Props {
  mapTitle: string;
  enabled?: boolean;
}

type ExportableLayer = L.Layer & {
  toGeoJSON?: () => GeoJSON.GeoJSON;
};

function mapCrs(map: L.Map) {
  return map.options.crs?.code ?? "EPSG:3857";
}

function safeFilename(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 70) || "savegeo_map"
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function collectFeatures(map: L.Map): Feature<Geometry, GeoJsonProperties>[] {
  const features: Feature<Geometry, GeoJsonProperties>[] = [];
  map.eachLayer((rawLayer) => {
    const layer = rawLayer as ExportableLayer;
    if (!layer.toGeoJSON || layer instanceof L.TileLayer) return;
    try {
      const geo = layer.toGeoJSON();
      const options = layer.options as
        (L.LayerOptions & { attribution?: string; pane?: string }) | undefined;
      const layerName = options?.attribution || options?.pane || layer.constructor.name;
      const values =
        geo.type === "FeatureCollection"
          ? geo.features
          : geo.type === "Feature"
            ? [geo]
            : [{ type: "Feature" as const, properties: {}, geometry: geo }];
      for (const feature of values) {
        features.push({
          ...feature,
          properties: { ...(feature.properties ?? {}), _savegeo_layer: layerName },
        } as Feature<Geometry, GeoJsonProperties>);
      }
    } catch {
      // Unsupported/custom layers are simply not part of the vector export.
    }
  });
  return features;
}

function buildCollection(map: L.Map): FeatureCollection<Geometry, GeoJsonProperties> {
  return {
    type: "FeatureCollection",
    features: collectFeatures(map),
  };
}

function quoteCsv(value: unknown) {
  const text =
    value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function collectionToCsv(collection: FeatureCollection<Geometry, GeoJsonProperties>) {
  const propertyNames = Array.from(
    new Set(collection.features.flatMap((feature) => Object.keys(feature.properties ?? {}))),
  );
  const columns = [...propertyNames, "_geometry_geojson"];
  return [
    columns.map(quoteCsv).join(","),
    ...collection.features.map((feature) =>
      [
        ...propertyNames.map((name) => quoteCsv(feature.properties?.[name])),
        quoteCsv(feature.geometry),
      ].join(","),
    ),
  ].join("\r\n");
}

function mapMetadata(
  map: L.Map,
  title: string,
  collection: FeatureCollection<Geometry, GeoJsonProperties>,
) {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    application: "SAVEGEO",
    exported_at: new Date().toISOString(),
    title,
    view: {
      map_id: map.getContainer().id || null,
      center: { latitude: center.lat, longitude: center.lng },
      zoom: map.getZoom(),
      bounds: bounds.toBBoxString(),
      crs: mapCrs(map),
      url: window.location.href,
    },
    feature_count: collection.features.length,
    geojson: collection,
  };
}

async function renderMap(map: L.Map) {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(map.getContainer(), {
    allowTaint: false,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    scale: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
    ignoreElements: (element) => element.classList?.contains("savegeo-map-export") ?? false,
  });
}

function toWebMercator(lat: number, lng: number): [number, number] {
  const radius = 6378137;
  const limitedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const x = (radius * lng * Math.PI) / 180;
  const y = radius * Math.log(Math.tan(Math.PI / 4 + (limitedLat * Math.PI) / 360));
  return [x, y];
}

function geoTiffFromCanvas(canvas: HTMLCanvasElement, map: L.Map) {
  if (mapCrs(map) !== "EPSG:3857") {
    throw new Error("Ekspor GeoTIFF tampilan saat ini mendukung peta EPSG:3857.");
  }
  const size = map.getSize();
  const topLeft = map.containerPointToLatLng([0, 0]);
  const bottomRight = map.containerPointToLatLng([size.x, size.y]);
  const [minX, maxY] = toWebMercator(topLeft.lat, topLeft.lng);
  const [maxX, minY] = toWebMercator(bottomRight.lat, bottomRight.lng);
  const pixels = canvas
    .getContext("2d", { willReadFrequently: true })
    ?.getImageData(0, 0, canvas.width, canvas.height).data;
  if (!pixels) throw new Error("Citra peta tidak dapat dibaca untuk membuat GeoTIFF.");

  const interleavedRgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let source = 0, target = 0; source < pixels.length; source += 4, target += 3) {
    interleavedRgb[target] = pixels[source];
    interleavedRgb[target + 1] = pixels[source + 1];
    interleavedRgb[target + 2] = pixels[source + 2];
  }
  return import("geotiff").then(({ writeArrayBuffer }) =>
    writeArrayBuffer(interleavedRgb, {
      width: canvas.width,
      height: canvas.height,
      BitsPerSample: [8, 8, 8],
      SamplesPerPixel: [3],
      PhotometricInterpretation: 2,
      PlanarConfiguration: 1,
      Compression: 1,
      ModelPixelScale: [(maxX - minX) / canvas.width, (maxY - minY) / canvas.height, 0],
      ModelTiepoint: [0, 0, 0, minX, maxY, 0],
      ProjectedCSTypeGeoKey: 3857,
      GTModelTypeGeoKey: 1,
      GTRasterTypeGeoKey: 1,
      GTCitationGeoKey: "WGS 84 / Pseudo-Mercator (EPSG:3857)",
    }),
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

function openPrintLayout(printWindow: Window, imageUrl: string, title: string, map: L.Map) {
  const center = map.getCenter();
  const bounds = map.getBounds();
  const safeTitle = escapeHtml(title);
  const safeImageUrl = imageUrl.replace(/"/g, "&quot;");
  printWindow.document.open();
  printWindow.document
    .write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${safeTitle} — SAVEGEO</title><style>
    @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#172b36;font:14px/1.45 Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:1px solid #bccbd2;padding:0 0 12px;margin-bottom:12px}h1{font-size:22px;margin:0 0 4px}.meta{font-size:11px;color:#52636b}.map{display:block;width:100%;height:auto;max-height:165mm;object-fit:contain;margin:0 auto}.note{font-size:10px;color:#62747b;margin-top:8px}.actions{position:fixed;right:18px;top:12px;display:flex;gap:8px}.actions button{border:0;border-radius:6px;padding:9px 13px;background:#166534;color:white;font-weight:700;cursor:pointer}.actions button.secondary{background:#e8eef0;color:#243a44}@media print{.actions{display:none}.map{max-height:165mm}}
  </style></head><body><div class="actions"><button onclick="window.print()">Cetak / Simpan PDF</button><button class="secondary" onclick="window.close()">Tutup</button></div><header><div><h1>${safeTitle}</h1><div class="meta">SAVEGEO · ${new Date().toLocaleString("id-ID")} · CRS ${escapeHtml(mapCrs(map))}</div></div><div class="meta">Pusat ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)} · Zoom ${map.getZoom()}<br>Batas ${bounds.toBBoxString()}</div></header><img class="map" src="${safeImageUrl}" alt="Peta ${safeTitle}"><div class="note">Gunakan tombol “Cetak / Simpan PDF”, kemudian pilih printer atau “Save as PDF”. GeoTIFF tampilan adalah hasil visualisasi layar; untuk raster analitik gunakan ekspor GeoTIFF pada modul analisis terkait.</div></body></html>`);
  printWindow.document.close();
  printWindow.focus();
}

export default function MapExportControl({ mapTitle, enabled = true }: Props) {
  const map = useMap();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(
    mapTitle
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]/g, " ")
      .replace(/\s*Map$/i, "") || "Peta SAVEGEO",
  );
  const [busy, setBusy] = useState<ExportAction | null>(null);
  const [message, setMessage] = useState("");
  const filename = safeFilename(title);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function run(action: ExportAction) {
    setBusy(action);
    setMessage("");
    let printWindow: Window | null = null;
    try {
      if (action === "print") {
        printWindow = window.open("", "_blank");
        if (!printWindow)
          throw new Error("Jendela cetak diblokir. Izinkan pop-up untuk SAVEGEO lalu coba lagi.");
        printWindow.document.write(
          "<!doctype html><title>Menyiapkan peta…</title><p style='font:16px Arial;padding:24px'>Menyiapkan layout peta…</p>",
        );
      }
      if (action === "geojson" || action === "csv" || action === "json") {
        const collection = buildCollection(map);
        if (action === "geojson") {
          saveBlob(
            new Blob([JSON.stringify(collection, null, 2)], {
              type: "application/geo+json;charset=utf-8",
            }),
            `${filename}.geojson`,
          );
        } else if (action === "csv") {
          saveBlob(
            new Blob(["\uFEFF", collectionToCsv(collection)], { type: "text/csv;charset=utf-8" }),
            `${filename}_atribut.csv`,
          );
        } else {
          saveBlob(
            new Blob([JSON.stringify(mapMetadata(map, title, collection), null, 2)], {
              type: "application/json;charset=utf-8",
            }),
            `${filename}_data.json`,
          );
        }
      } else {
        const canvas = await renderMap(map);
        if (action === "png") {
          const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (value) => (value ? resolve(value) : reject(new Error("PNG tidak dapat dibuat."))),
              "image/png",
            ),
          );
          saveBlob(blob, `${filename}.png`);
        } else if (action === "geotiff") {
          const buffer = await geoTiffFromCanvas(canvas, map);
          saveBlob(new Blob([buffer], { type: "image/tiff" }), `${filename}_tampilan_epsg3857.tif`);
          setMessage(
            "GeoTIFF RGB dibuat dari tampilan peta dan georeferensi viewport; ini bukan raster analitik sumber.",
          );
        } else {
          openPrintLayout(printWindow!, canvas.toDataURL("image/png"), title, map);
        }
      }
    } catch (error) {
      printWindow?.close();
      setMessage(error instanceof Error ? error.message : "Ekspor gagal. Silakan coba lagi.");
    } finally {
      setBusy(null);
    }
  }

  if (!enabled) return null;
  return createPortal(
    <div
      ref={rootRef}
      className="savegeo-map-export"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="savegeo-map-export__trigger"
        aria-label="Ekspor peta dan data"
        aria-expanded={open}
        title="Ekspor peta dan data"
        onClick={() => setOpen((value) => !value)}
      >
        <i className="bi bi-download" aria-hidden="true" />
        <span>Ekspor</span>
      </button>
      {open && (
        <section
          className="savegeo-map-export__menu"
          role="dialog"
          aria-label="Ekspor peta dan data"
        >
          <header className="savegeo-map-export__header">
            <strong>Ekspor peta &amp; data</strong>
            <button type="button" aria-label="Tutup" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <label
            className="savegeo-map-export__label"
            htmlFor={`map-export-title-${map.getContainer().id || "map"}`}
          >
            Judul peta
          </label>
          <input
            id={`map-export-title-${map.getContainer().id || "map"}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={100}
          />
          <div className="savegeo-map-export__section-title">Peta</div>
          <button
            type="button"
            className="savegeo-map-export__item"
            disabled={!!busy}
            onClick={() => void run("png")}
          >
            <i className="bi bi-filetype-png" /> Unduh gambar PNG
          </button>
          <button
            type="button"
            className="savegeo-map-export__item"
            disabled={!!busy}
            onClick={() => void run("geotiff")}
          >
            <i className="bi bi-globe2" /> GeoTIFF tampilan (RGB)
          </button>
          <button
            type="button"
            className="savegeo-map-export__item"
            disabled={!!busy}
            onClick={() => void run("print")}
          >
            <i className="bi bi-printer" /> Cetak / simpan sebagai PDF
          </button>
          <div className="savegeo-map-export__section-title">Data vektor &amp; tampilan</div>
          <button
            type="button"
            className="savegeo-map-export__item"
            disabled={!!busy}
            onClick={() => void run("geojson")}
          >
            <i className="bi bi-braces" /> GeoJSON (layer vektor aktif)
          </button>
          <button
            type="button"
            className="savegeo-map-export__item"
            disabled={!!busy}
            onClick={() => void run("csv")}
          >
            <i className="bi bi-filetype-csv" /> CSV atribut
          </button>
          <button
            type="button"
            className="savegeo-map-export__item"
            disabled={!!busy}
            onClick={() => void run("json")}
          >
            <i className="bi bi-filetype-json" /> JSON data &amp; metadata peta
          </button>
          <p className="savegeo-map-export__hint">
            GeoTIFF ini menyimpan citra tampilan yang tergeoreferensi, bukan data raster analitik.
            PDF dibuka sebagai layout cetak; pilih “Simpan sebagai PDF”. Tile dari penyedia
            eksternal yang membatasi CORS mungkin tidak muncul pada gambar ekspor.
          </p>
          {busy && (
            <div className="savegeo-map-export__status" role="status">
              <span className="spinner-border spinner-border-sm" /> Menyiapkan ekspor…
            </div>
          )}
          {message && (
            <div className="savegeo-map-export__message" role="status">
              {message}
            </div>
          )}
        </section>
      )}
    </div>,
    map.getContainer(),
  );
}
