import { UrlTemplateImageryProvider, WebMapTileServiceImageryProvider, WebMercatorTilingScheme } from "cesium";
import type { BasemapDefinition } from "@/types/map";

/** Keep provider-defined x/y order. Esri deliberately uses z/y/x. */
export function tileTemplate(url: string) { return url.replace(/\{r\}/g, ""); }
export function imageryProvider(url: string, attribution?: string, maxZoom = 19, wmts?: BasemapDefinition["wmts"], tileSize = 256) {
  if (wmts) return new WebMapTileServiceImageryProvider({ url, ...wmts, credit: attribution, maximumLevel: maxZoom, tilingScheme: new WebMercatorTilingScheme() });
  return new UrlTemplateImageryProvider({ url: tileTemplate(url), subdomains: ["a", "b", "c"], tileWidth: tileSize, tileHeight: tileSize, credit: attribution, maximumLevel: maxZoom, tilingScheme: new WebMercatorTilingScheme() });
}
