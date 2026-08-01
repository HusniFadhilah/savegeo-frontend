export interface BasemapDefinition {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  isDefault: boolean;
  order: number;
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
