import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { RESULT_PANE } from "@/config/mapPanes";
import { HIGH_DETAIL_MAX_ZOOM, RESULT_TILE_MAX_NATIVE_ZOOM } from "@/config/mapZoom";

interface Props {
  /** Remount (and thus re-add) whenever this changes, e.g. the active result tab key. */
  layerKey: string;
  tileUrl: string;
  opacity: number;
  attribution?: string;
}

const TRANSPARENT_TILE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * Thin wrapper around a raw Leaflet tileLayer for GEE result tiles (carbon /
 * vegetation index / land cover class tiles). Not a react-leaflet <TileLayer>
 * because the tile URL changes per result tab and we want a clean
 * add/remove per `layerKey` rather than react-leaflet's URL-diffing.
 */
export default function ResultTileLayer({ layerKey, tileUrl, opacity, attribution }: Props) {
  const map = useMap();

  useEffect(() => {
    if (!tileUrl) return;
    const layer = L.tileLayer(tileUrl, {
      attribution: attribution ?? "© Google Earth Engine",
      className: "gee-tile-layer",
      pane: map.getPane(RESULT_PANE) ? RESULT_PANE : undefined,
      maxNativeZoom: RESULT_TILE_MAX_NATIVE_ZOOM,
      maxZoom: HIGH_DETAIL_MAX_ZOOM,
      opacity,
      errorTileUrl: TRANSPARENT_TILE,
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, layerKey, tileUrl]);

  useEffect(() => {
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer && (layer.options as { className?: string }).className === "gee-tile-layer") {
        layer.setOpacity(opacity);
      }
    });
  }, [map, opacity]);

  return null;
}
