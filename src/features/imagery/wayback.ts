import type { ImageryScene } from "./types";

const WAYBACK_CAPABILITIES_URL =
  "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/WMTS/1.0.0/WMTSCapabilities.xml";
const WAYBACK_CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

let cachedCatalog: { expiresAt: number; promise: Promise<WaybackScene[]> } | null = null;

/** The archive starts with the first 2014 release; use this for the initial
 * provider range because the archive is released monthly rather than daily. */
export const ESRI_WAYBACK_START_DATE = "2014-01-01";

export interface WaybackScene extends ImageryScene {
  tile_url: string;
  release_label: string;
}

/** Pick the latest published Wayback snapshot that does not exceed the analysis date. */
export function selectEsriWaybackScene(scenes: WaybackScene[], targetDate: string): WaybackScene | null {
  const candidates = scenes.filter((scene) => scene.release_label <= targetDate).sort((a, b) => b.release_label.localeCompare(a.release_label));
  return candidates[0] ?? scenes.slice().sort((a, b) => a.release_label.localeCompare(b.release_label))[0] ?? null;
}

function childText(node: Element, localName: string): string | null {
  const found = Array.from(node.getElementsByTagName("*")).find((el) => el.localName === localName);
  return found?.textContent?.trim() ?? null;
}

function normalizeWaybackTileUrl(template: string): string {
  return template
    .trim()
    // Esri advertises both GoogleMapsCompatible and default028mm matrices;
    // Leaflet's XYZ grid must use the former so z/x/y indices line up.
    .replace("{TileMatrixSet}", "GoogleMapsCompatible")
    .replace("{TileMatrix}", "{z}")
    .replace("{TileRow}", "{y}")
    .replace("{TileCol}", "{x}")
    .replace("{level}", "{z}")
    .replace("{row}", "{y}")
    .replace("{col}", "{x}");
}

function parseWaybackDate(title: string): string | null {
  const match = title.match(/Wayback\s+(\d{4}-\d{2}-\d{2})/i);
  return match?.[1] ?? null;
}

async function loadWaybackCatalog(): Promise<WaybackScene[]> {
  const res = await fetch(WAYBACK_CAPABILITIES_URL);
  if (!res.ok) throw new Error(`Gagal memuat Esri Wayback (${res.status}).`);

  const xmlText = await res.text();
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Respons Esri Wayback tidak dapat dibaca.");

  const layers = Array.from(doc.getElementsByTagName("*")).filter((el) => el.localName === "Layer");
  const scenes = layers
    .map((layer): WaybackScene | null => {
      const title = childText(layer, "Title") ?? "";
      const date = parseWaybackDate(title);
      const resource = Array.from(layer.getElementsByTagName("*")).find(
        (el) => el.localName === "ResourceURL" && el.getAttribute("resourceType") === "tile",
      );
      const template = resource?.getAttribute("template")?.trim();
      const identifier = childText(layer, "Identifier");
      if (!date || !template || !identifier) return null;
      return {
        id: `esri_wayback:${identifier}`,
        acquired_at: `${date}T00:00:00Z`,
        cloud_cover_pct: null,
        tile_url: normalizeWaybackTileUrl(template),
        release_label: date,
      };
    })
    .filter((scene): scene is WaybackScene => Boolean(scene))
    .sort((a, b) => (a.acquired_at < b.acquired_at ? 1 : -1));

  return scenes;
}

function waybackCatalog(): Promise<WaybackScene[]> {
  if (cachedCatalog && cachedCatalog.expiresAt > Date.now()) return cachedCatalog.promise;

  const promise = loadWaybackCatalog().catch(error => {
    if (cachedCatalog?.promise === promise) cachedCatalog = null;
    throw error;
  });
  cachedCatalog = { expiresAt: Date.now() + WAYBACK_CATALOG_TTL_MS, promise };
  return promise;
}

export async function listEsriWaybackScenes(startDate: string, endDate: string, limit = 2000): Promise<WaybackScene[]> {
  const scenes = await waybackCatalog();
  return scenes.filter(scene => scene.release_label >= startDate && scene.release_label <= endDate).slice(0, limit);
}
