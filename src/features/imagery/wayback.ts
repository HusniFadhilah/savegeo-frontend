import type { ImageryScene } from "./types";

const WAYBACK_CAPABILITIES_URL =
  "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/WMTS/1.0.0/WMTSCapabilities.xml";

/** The archive starts with the first 2014 release; use this for the initial
 * provider range because the archive is released monthly rather than daily. */
export const ESRI_WAYBACK_START_DATE = "2014-01-01";

export interface WaybackScene extends ImageryScene {
  tile_url: string;
  release_label: string;
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

export async function listEsriWaybackScenes(startDate: string, endDate: string): Promise<WaybackScene[]> {
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
      if (date < startDate || date > endDate) return null;
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

  return scenes.slice(0, 200);
}
