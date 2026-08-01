import { kml as kmlToGeoJSON } from "@tmcw/togeojson";

/** Icon class (Bootstrap Icons) keyed by mime type, used in file preview chips/badges. */
export const FILE_ICONS: Record<string, string> = {
  "application/pdf": "bi-file-earmark-pdf",
  "text/csv": "bi-file-earmark-spreadsheet",
  "application/json": "bi-file-earmark-code",
  "text/plain": "bi-file-earmark-text",
  "text/markdown": "bi-file-earmark-text",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "bi-file-earmark-word",
  "application/zip": "bi-file-earmark-zip",
  "application/x-zip-compressed": "bi-file-earmark-zip",
  "application/vnd.google-earth.kml+xml": "bi-globe",
  "application/vnd.google-earth.kmz": "bi-globe",
};
export const DEFAULT_FILE_ICON = "bi-file-earmark";

export const TEXT_MIME_TYPES = ["text/plain", "text/csv", "application/json", "text/markdown", "text/md"];

export function iconForMime(mime: string): string {
  return FILE_ICONS[mime] || DEFAULT_FILE_ICON;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function stripDataUrlPrefix(dataUrl: string): string {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Gagal membaca file."));
    reader.readAsText(file, "UTF-8");
  });
}

/** KML (Polygon/Placemark/MultiGeometry) -> GeoJSON FeatureCollection, via @tmcw/togeojson. */
export function parseKmlToGeoJSON(kmlText: string): GeoJSON.FeatureCollection | null {
  try {
    const doc = new DOMParser().parseFromString(kmlText, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    const fc = kmlToGeoJSON(doc);
    const polygonFeatures = (fc.features || []).filter(
      (f): f is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> =>
        !!f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"),
    );
    if (!polygonFeatures.length) return null;
    return { type: "FeatureCollection", features: polygonFeatures };
  } catch {
    return null;
  }
}

/** Mirrors savegeo-chatbot.js's isValidAOI check for an uploaded/parsed GeoJSON payload. */
export function isValidAoiGeoJSON(geo: unknown): geo is GeoJSON.GeoJSON {
  if (!geo || typeof geo !== "object") return false;
  const g = geo as { type?: string; geometry?: { type?: string }; features?: unknown[] };
  if (g.type === "Feature" && g.geometry && (g.geometry.type === "Polygon" || g.geometry.type === "MultiPolygon")) {
    return true;
  }
  if (g.type === "Polygon" || g.type === "MultiPolygon") return true;
  if (g.type === "FeatureCollection" && Array.isArray(g.features) && g.features.length > 0) return true;
  return false;
}

/** Extracts a display name from a parsed GeoJSON AOI payload, falling back to the filename. */
export function aoiNameFromGeoJSON(geo: GeoJSON.GeoJSON, fileName: string): string {
  const g = geo as unknown as {
    features?: { properties?: { name?: string } }[];
    properties?: { name?: string };
  };
  return (
    g.features?.[0]?.properties?.name ||
    g.properties?.name ||
    fileName.replace(/\.geojson?$/i, "")
  );
}

/** Normalizes a parsed GeoJSON AOI payload to a single Feature, as the AI-set-AOI actions expect. */
export function aoiFeatureFromGeoJSON(geo: GeoJSON.GeoJSON, name: string): GeoJSON.Feature {
  if (geo.type === "FeatureCollection") return geo.features[0];
  if (geo.type === "Polygon" || geo.type === "MultiPolygon") {
    return { type: "Feature", geometry: geo, properties: { name } };
  }
  return geo as GeoJSON.Feature;
}
