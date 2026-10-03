import type { BasemapDefinition } from "@/types/map";

interface GoogleMapsSessionResponse {
  session?: string;
}

export interface GoogleViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

let sessionApiKey = "";
let sessionValue: string | null = null;
let sessionRequest: Promise<string | null> | null = null;

/** Create a session only when a browser key is configured. */
export async function getGoogleMapsSession(apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ""): Promise<string | null> {
  if (!apiKey) return null;
  if (sessionApiKey === apiKey && sessionValue) return sessionValue;
  if (sessionApiKey === apiKey && sessionRequest) return sessionRequest;

  sessionApiKey = apiKey;
  sessionValue = null;
  const url = new URL("https://tile.googleapis.com/v1/createSession");
  url.searchParams.set("key", apiKey);
  sessionRequest = fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapType: "satellite", language: "id-ID", region: "ID" }),
  }).then(async (response) => {
    if (!response.ok) throw new Error("Google Maps session request failed");
    const payload = await response.json() as GoogleMapsSessionResponse;
    if (!payload.session) throw new Error("Google Maps session was missing");
    sessionValue = payload.session;
    return sessionValue;
  }).catch(() => {
    sessionValue = null;
    return null;
  }).finally(() => {
    sessionRequest = null;
  });
  return sessionRequest;
}

/** Append Google Satellite only when its configured key can create a session. */
export async function withOptionalGoogleSatelliteBasemap(basemaps: BasemapDefinition[]): Promise<BasemapDefinition[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return basemaps;

  const session = await getGoogleMapsSession(apiKey);
  if (!session) return basemaps;

  const google: BasemapDefinition = {
    id: "google-satellite",
    name: "Google Satellite (display only)",
    url: `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(apiKey)}`,
    attribution: '<span class="savegeo-google-maps-attribution" translate="no">Google Maps</span>',
    maxZoom: 22,
    maxNativeZoom: 22,
    isDefault: false,
    order: 1.7,
  };
  return [...basemaps.filter((basemap) => basemap.id !== google.id), google]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

function normalizeLongitude(longitude: number): number {
  const wrapped = ((longitude + 180) % 360 + 360) % 360 - 180;
  return Math.max(-179.999999, Math.min(179.999999, wrapped));
}

function normalizeLatitude(latitude: number): number {
  return Math.max(-89.999999, Math.min(89.999999, latitude));
}

/** Return viewport-specific copyright from Google's metadata endpoint. */
export async function fetchGoogleViewportCopyright(
  bounds: GoogleViewportBounds,
  zoom: number,
): Promise<string | null> {
  const session = await getGoogleMapsSession();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!session || !apiKey) return null;

  const url = new URL("https://tile.googleapis.com/tile/v1/viewport");
  url.searchParams.set("session", session);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("zoom", String(Math.max(0, Math.min(22, Math.floor(zoom)))));
  url.searchParams.set("north", String(normalizeLatitude(bounds.north)));
  url.searchParams.set("south", String(normalizeLatitude(bounds.south)));
  url.searchParams.set("east", String(normalizeLongitude(bounds.east)));
  url.searchParams.set("west", String(normalizeLongitude(bounds.west)));

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json() as { copyright?: unknown };
    return typeof payload.copyright === "string" && payload.copyright.trim() ? payload.copyright.trim() : null;
  } catch {
    return null;
  }
}

/** Treat the provider's text as text when inserted into Leaflet/Cesium credits. */
export function escapeAttributionHtml(value: string): string {
  return value.replace(/[&<>]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  })[character] ?? character);
}
