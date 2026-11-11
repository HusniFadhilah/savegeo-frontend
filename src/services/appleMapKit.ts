import L from "leaflet";
import { apiClient } from "@/services/apiClient";
import type { BasemapDefinition } from "@/types/map";

/**
 * Apple satellite imagery is available to web pages only through MapKit JS
 * (there is no public raster tile API). This module loads MapKit JS, obtains
 * short-lived tokens from the backend (which holds the MapKit private key) and
 * renders an Apple map underneath Leaflet, kept in sync with Leaflet's view.
 * Apple's own logo and legal link stay visible as MapKit requires.
 */

export const APPLE_MAPKIT_SCRIPT = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js";
export const APPLE_BASEMAP_IDS = ["apple-satellite", "apple-hybrid"] as const;
const APPLE_ATTRIBUTION = '<a href="https://www.apple.com/legal/internet-services/maps/" target="_blank" rel="noreferrer">© Apple Maps</a>';

interface TokenResponse {
  token: string;
  expires_at: number;
}

interface MapKitStatusResponse {
  available: boolean;
}

/* Minimal MapKit JS surface used here. */
interface MapKitMapRect { origin: unknown; size: unknown }
interface MapKitMap {
  visibleMapRect: MapKitMapRect;
  destroy(): void;
}
interface MapKitNamespace {
  init(options: { authorizationCallback: (done: (token: string) => void) => void; language?: string }): void;
  Map: (new (element: HTMLElement, options: Record<string, unknown>) => MapKitMap) & { MapTypes: Record<string, string> };
  MapRect: new (x: number, y: number, width: number, height: number) => MapKitMapRect;
  FeatureVisibility: Record<string, string>;
}

declare global {
  interface Window {
    mapkit?: MapKitNamespace;
    __savegeoMapKitReady?: () => void;
  }
}

let cachedToken: TokenResponse | null = null;
let tokenRequest: Promise<TokenResponse | null> | null = null;

/** Fetch (and reuse until shortly before expiry) a MapKit token; null when Apple is unavailable. */
export async function fetchAppleMapKitToken(): Promise<TokenResponse | null> {
  const now = Date.now() / 1000;
  if (cachedToken && cachedToken.expires_at - now > 60) return cachedToken;
  tokenRequest ??= apiClient.get<TokenResponse>("/maps/apple-mapkit/token")
    .then((response) => (cachedToken = response?.token ? response : null))
    .catch(() => (cachedToken = null))
    .finally(() => { tokenRequest = null; });
  return tokenRequest;
}

let mapkitLoader: Promise<MapKitNamespace> | null = null;

function loadMapKit(language: string): Promise<MapKitNamespace> {
  mapkitLoader ??= new Promise<MapKitNamespace>((resolve, reject) => {
    const ready = () => {
      const mapkit = window.mapkit;
      if (!mapkit) { reject(new Error("MapKit JS did not load")); return; }
      mapkit.init({
        language,
        authorizationCallback: (done) => {
          void fetchAppleMapKitToken().then((token) => { if (token) done(token.token); });
        },
      });
      resolve(mapkit);
    };
    window.__savegeoMapKitReady = ready;
    const script = document.createElement("script");
    script.src = APPLE_MAPKIT_SCRIPT;
    script.crossOrigin = "anonymous";
    script.async = true;
    script.dataset.libraries = "map";
    script.dataset.callback = "__savegeoMapKitReady";
    script.onerror = () => { mapkitLoader = null; reject(new Error("MapKit JS failed to load")); };
    document.head.appendChild(script);
  });
  return mapkitLoader;
}

/**
 * Leaflet's current view as a MapKit MapRect (normalized Web Mercator, 0..1),
 * so both maps show exactly the same area.
 */
export function mapRectForView(pixelBounds: L.Bounds, zoom: number): [number, number, number, number] {
  const worldSize = 256 * 2 ** zoom;
  const min = pixelBounds.min ?? L.point(0, 0);
  const max = pixelBounds.max ?? min;
  return [min.x / worldSize, min.y / worldSize, (max.x - min.x) / worldSize, (max.y - min.y) / worldSize];
}

export interface AppleMapKitLayerOptions extends L.LayerOptions {
  className: string;
  mapType: "satellite" | "hybrid";
  attribution: string;
  language: string;
}

/** A Leaflet base layer rendered by MapKit JS beneath the map's overlays. */
export class AppleMapKitLayer extends L.Layer {
  declare options: AppleMapKitLayerOptions;
  private container: HTMLDivElement | null = null;
  private appleMap: MapKitMap | null = null;
  private mapkit: MapKitNamespace | null = null;
  private frame = 0;

  constructor(options: AppleMapKitLayerOptions) {
    super(options);
    L.setOptions(this, options);
  }

  onAdd(map: L.Map): this {
    const container = L.DomUtil.create("div", `savegeo-apple-mapkit-layer ${this.options.className}`, map.getPane("tilePane"));
    Object.assign(container.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none", zIndex: "1" });
    this.container = container;
    this.reposition();
    map.on("move zoomend resize viewreset", this.scheduleSync, this);
    void loadMapKit(this.options.language).then((mapkit) => {
      if (!this.container || this._map !== map) return;
      this.mapkit = mapkit;
      this.appleMap = new mapkit.Map(this.container, {
        mapType: this.options.mapType === "hybrid" ? mapkit.Map.MapTypes.Hybrid : mapkit.Map.MapTypes.Satellite,
        isRotationEnabled: false,
        isScrollEnabled: false,
        isZoomEnabled: false,
        showsCompass: mapkit.FeatureVisibility.Hidden,
        showsScale: mapkit.FeatureVisibility.Hidden,
        showsZoomControl: false,
        showsMapTypeControl: false,
        showsPointsOfInterest: false,
      });
      this.sync();
    }).catch(() => {
      container.dataset.error = "mapkit-unavailable";
    });
    return this;
  }

  onRemove(map: L.Map): this {
    map.off("move zoomend resize viewreset", this.scheduleSync, this);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.appleMap?.destroy();
    this.appleMap = null;
    this.container?.remove();
    this.container = null;
    return this;
  }

  getAttribution(): string {
    return this.options.attribution;
  }

  private scheduleSync(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.sync();
    });
  }

  /** Keep the MapKit container covering the viewport inside the panning tile pane. */
  private reposition(): void {
    const map = this._map;
    if (!map || !this.container) return;
    const size = map.getSize();
    L.DomUtil.setPosition(this.container, map.containerPointToLayerPoint([0, 0]));
    this.container.style.width = `${size.x}px`;
    this.container.style.height = `${size.y}px`;
  }

  private sync(): void {
    const map = this._map;
    this.reposition();
    if (!map || !this.appleMap || !this.mapkit) return;
    const [x, y, width, height] = mapRectForView(map.getPixelBounds(), map.getZoom());
    this.appleMap.visibleMapRect = new this.mapkit.MapRect(x, y, width, height);
  }
}

/** Add the Apple basemaps only when the backend can issue MapKit tokens. */
export async function withOptionalAppleBasemaps(basemaps: BasemapDefinition[]): Promise<BasemapDefinition[]> {
  const status = await apiClient.get<MapKitStatusResponse>("/maps/apple-mapkit/status").catch(() => null);
  if (!status?.available) return basemaps;
  const token = await fetchAppleMapKitToken();
  if (!token) return basemaps;
  const apple: BasemapDefinition[] = [
    { id: "apple-satellite", name: "Apple Satellite (display only)", url: "", renderer: "mapkit", mapkitType: "satellite", attribution: APPLE_ATTRIBUTION, maxZoom: 20, maxNativeZoom: 20, isDefault: false, order: 1.8 },
    { id: "apple-hybrid", name: "Apple Satellite + Labels", url: "", renderer: "mapkit", mapkitType: "hybrid", attribution: APPLE_ATTRIBUTION, maxZoom: 20, maxNativeZoom: 20, isDefault: false, order: 1.81 },
  ];
  const ids = new Set(apple.map((basemap) => basemap.id));
  return [...basemaps.filter((basemap) => !ids.has(basemap.id)), ...apple].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export function isMapKitBasemap(basemap: BasemapDefinition | undefined | null): boolean {
  return basemap?.renderer === "mapkit";
}

export function createBasemapMapKitLayer(basemap: BasemapDefinition, className: string, language: string): AppleMapKitLayer {
  return new AppleMapKitLayer({
    className,
    mapType: basemap.mapkitType ?? "satellite",
    attribution: basemap.attribution,
    language,
  });
}
