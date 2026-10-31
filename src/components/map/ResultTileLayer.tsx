import RasterResolutionNotice from "./RasterResolutionNotice";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { RESULT_PANE, RESULT_PANE_Z_INDEX } from "@/config/mapPanes";
import { HIGH_DETAIL_MAX_ZOOM, nativeZoomForResolution } from "@/config/mapZoom";
import { installResultTileRetry } from "./resultTileRetry";

interface Props {
  /** Remount (and thus re-add) whenever this changes, e.g. the active result tab key. */
  layerKey: string;
  tileUrl: string;
  opacity: number;
  attribution?: string;
  resolutionM?: number;
  /** AOI used to keep result pixels inside the selected analysis geometry. */
  clipGeometry?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
}

/**
 * Thin wrapper around a raw Leaflet tileLayer for GEE result tiles (carbon /
 * vegetation index / land cover class tiles). Not a react-leaflet <TileLayer>
 * because the tile URL changes per result tab and we want a clean
 * add/remove per `layerKey` rather than react-leaflet's URL-diffing.
 */
function aoiClipPath(
  geometry: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  map: L.Map,
) {
  const polygons =
    geometry.geometry.type === "Polygon"
      ? [geometry.geometry.coordinates]
      : geometry.geometry.coordinates;
  const origin = map.containerPointToLayerPoint([0, 0]);
  const paths = polygons.flatMap((polygon) =>
    polygon.flatMap((ring) => {
      const points = ring.map(([lng, lat]) => {
        const point = map.latLngToContainerPoint([lat, lng]);
        return { x: point.x + origin.x, y: point.y + origin.y };
      });
      if (points.length < 4) return [];
      return [
        `M ${points.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")} Z`,
      ];
    }),
  );

  // evenodd preserves polygon holes and separate multipolygon islands.
  return paths.length ? `path(evenodd, "${paths.join(" ")}")` : 'path("M 0 0 Z")';
}

export default function ResultTileLayer({
  layerKey,
  tileUrl,
  opacity,
  attribution,
  resolutionM,
  clipGeometry,
}: Props) {
  const map = useMap();

  useEffect(() => {
    if (!clipGeometry) return;
    const pane = map.getPane(RESULT_PANE) ?? map.createPane(RESULT_PANE);
    pane.style.zIndex = String(RESULT_PANE_Z_INDEX);
    pane.style.pointerEvents = "none";

    const priorStyles = {
      position: pane.style.position,
      left: pane.style.left,
      top: pane.style.top,
      width: pane.style.width,
      height: pane.style.height,
      overflow: pane.style.overflow,
      clipPath: pane.style.clipPath,
      webkitClipPath: pane.style.getPropertyValue("-webkit-clip-path"),
    };
    pane.style.position = "absolute";
    pane.style.left = "0";
    pane.style.top = "0";
    pane.style.overflow = "visible";

    const updateClip = () => {
      const size = map.getSize();
      pane.style.width = `${size.x}px`;
      pane.style.height = `${size.y}px`;
      const clipPath = aoiClipPath(clipGeometry, map);
      pane.style.clipPath = clipPath;
      pane.style.setProperty("-webkit-clip-path", clipPath);
    };

    updateClip();
    map.on("move zoom resize", updateClip);
    return () => {
      map.off("move zoom resize", updateClip);
      pane.style.position = priorStyles.position;
      pane.style.left = priorStyles.left;
      pane.style.top = priorStyles.top;
      pane.style.width = priorStyles.width;
      pane.style.height = priorStyles.height;
      pane.style.overflow = priorStyles.overflow;
      pane.style.clipPath = priorStyles.clipPath;
      pane.style.setProperty("-webkit-clip-path", priorStyles.webkitClipPath);
    };
  }, [clipGeometry, map]);

  useEffect(() => {
    if (!tileUrl) return;
    const layer = L.tileLayer(tileUrl, {
      attribution: attribution ?? "© Google Earth Engine",
      className: "gee-tile-layer",
      pane: map.getPane(RESULT_PANE) ? RESULT_PANE : undefined,
      maxNativeZoom: nativeZoomForResolution(resolutionM),
      maxZoom: HIGH_DETAIL_MAX_ZOOM,
      opacity,
      errorTileUrl: L.Util.emptyImageUrl,
    });
    const stopRetrying = installResultTileRetry(layer, map);
    layer.addTo(map);
    return () => {
      stopRetrying();
      map.removeLayer(layer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, layerKey, tileUrl, resolutionM]);

  useEffect(() => {
    map.eachLayer((layer) => {
      if (
        layer instanceof L.TileLayer &&
        (layer.options as { className?: string }).className === "gee-tile-layer"
      ) {
        layer.setOpacity(opacity);
      }
    });
  }, [map, opacity]);

  return resolutionM ? (
    <RasterResolutionNotice layers={[{ label: layerKey, resolutionM, tileUrl }]} />
  ) : null;
}
