interface EsriIdentifyAttributes {
  [key: string]: string | undefined;
}

interface EsriIdentifyResult {
  attributes: EsriIdentifyAttributes;
}

interface EsriIdentifyResponse {
  results?: EsriIdentifyResult[];
}

const cache = new Map<string, Promise<string | null>>();

/**
 * Esri World Imagery is a mosaic stitched from many different provider
 * captures - there's no single "as of" date for the whole basemap, it
 * varies per location (and which resolution tier is visible at the current
 * zoom). This queries Esri's own identify service (the same one powers the
 * "Imagery Date" popup on arcgis.com's World Imagery viewer) for the
 * capture date of whichever source layer is actually visible at the given
 * point/zoom: picks the highest-draw-order candidate whose zoom range
 * covers the current view and that actually has a parseable
 * "DATE (YYYYMMDD)" (Esri returns the literal string "Null" for sources
 * that don't track one, e.g. the low-res TerraColor fallback layer).
 * Returns a human-readable Indonesian date, or null if nothing usable came
 * back - never throws, this is decorative attribution info, not analysis
 * data.
 */
export function fetchEsriImageryDate(lat: number, lng: number, zoom: number): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(zoom)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = lookupEsriImageryDate(lat, lng, zoom).catch(() => null);
  cache.set(key, promise);
  return promise;
}

async function lookupEsriImageryDate(lat: number, lng: number, zoom: number): Promise<string | null> {
  const delta = 0.01;
  const params = new URLSearchParams({
    f: "json",
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    sr: "4326",
    tolerance: "2",
    mapExtent: `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`,
    imageDisplay: "400,400,96",
    layers: "all",
    returnGeometry: "false",
  });
  const res = await fetch(
    `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/identify?${params.toString()}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as EsriIdentifyResponse;

  let best: { date: Date; drawOrder: number } | null = null;
  for (const result of data.results ?? []) {
    const attrs = result.attributes;
    const raw = attrs["DATE (YYYYMMDD)"];
    if (!raw || raw === "Null" || !/^\d{8}$/.test(raw)) continue;

    const minLevel = Number(attrs.MinMapLevel);
    const maxLevel = Number(attrs.MaxMapLevel);
    if (Number.isFinite(minLevel) && Number.isFinite(maxLevel) && (zoom < minLevel || zoom > maxLevel)) continue;

    const date = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;

    const drawOrder = Number(attrs.DrawOrder) || 0;
    if (!best || drawOrder > best.drawOrder) best = { date, drawOrder };
  }

  if (!best) return null;
  return best.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
