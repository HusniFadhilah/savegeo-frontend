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
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number;
  isDefault: boolean;
  order: number;
  enabled?: boolean;
  wmts?: BasemapWmtsOptions;
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
