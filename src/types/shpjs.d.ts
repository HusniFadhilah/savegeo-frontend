declare module "shpjs" {
  import type { FeatureCollection, Geometry } from "geojson";
  /** Parses a zipped Shapefile (.zip with .shp/.dbf/.prj) into GeoJSON. */
  export default function shp(
    source: ArrayBuffer | string,
  ): Promise<FeatureCollection<Geometry> | FeatureCollection<Geometry>[]>;
}
