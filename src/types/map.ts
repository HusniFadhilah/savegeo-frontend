import type { WebMapTileServiceImageryProvider } from "cesium";

export type BasemapWmtsOptions = Omit<
  ConstructorParameters<typeof WebMapTileServiceImageryProvider>[0],
  "url" | "credit" | "maximumLevel" | "tilingScheme"
>;

export interface BasemapDefinition {
  id: string;
  name: string;
  url: string;
  labelsUrl?: string;
  labelsAttribution?: string;
  overlayUrl?: string;
  overlayAttribution?: string;
  /** Highest native zoom supported reliably by a separate reference overlay. */
  overlayMaxNativeZoom?: number;
  attribution: string;
  tileSize?: number;
  zoomOffset?: number;
  maxZoom: number;
  maxNativeZoom?: number;
  isDefault: boolean;
  order: number;
  enabled?: boolean;
  wmts?: BasemapWmtsOptions;
  /** "mapkit" basemaps are drawn by Apple MapKit JS instead of a tile URL. */
  renderer?: "tiles" | "mapkit";
  mapkitType?: "satellite" | "hybrid";
}

export type AoiGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export interface AoiFeature {
  type: "Feature";
  geometry: AoiGeometry;
  properties: Record<string, unknown>;
}

export interface ResultLayer {
  id: string;
  label: string;
  tileUrl: string;
  opacity: number;
  visible: boolean;
}

export interface MapLegendEntry {
  color: string;
  label: string;
  value?: string | number;
}
