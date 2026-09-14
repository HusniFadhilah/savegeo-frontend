import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { GlobeLayer } from "./GlobeView";
import { useBasemaps } from "@/hooks/useBasemaps";
import { useUserGeolocation } from "@/hooks/useUserGeolocation";

/** Adapter for the actual visible Leaflet layers, including module-specific results. */
export function GlobeLayerBridge({ enabled, onLayers }: { enabled: boolean; onLayers: (layers: GlobeLayer[]) => void }) {
  const map = useMap();
  const { basemaps } = useBasemaps();
  useEffect(() => {
    if (!enabled) return;
    const baseUrls = new Set(basemaps.flatMap(b => [b.url, b.overlayUrl, b.labelsUrl].filter(Boolean)));
    let signature = "";
    const sync = () => {
      const layers: GlobeLayer[] = [];
      const seen = new Set<number>();
      const visit = (layer: L.Layer) => {
        const id = L.Util.stamp(layer);
        if (seen.has(id) || layer.options?.pane === "user-location") return;
        seen.add(id);
        if (layer instanceof L.TileLayer) {
          const url = (layer as L.TileLayer & { _url: string })._url;
          if (baseUrls.has(url) || layer.options.className === "savegeo-basemap-layer") return;
          const attribution = typeof layer.getAttribution === "function" ? layer.getAttribution?.() : undefined;
          layers.push({ id: String(id), type: "raster", url, opacity: layer.options.opacity, attribution: attribution ?? undefined, maxNativeZoom: layer.options.maxNativeZoom, maxZoom: layer.options.maxZoom });
        } else if (layer instanceof L.LayerGroup) {
          layer.eachLayer(visit);
        } else if ("toGeoJSON" in layer && typeof layer.toGeoJSON === "function") {
          const geoLayer = layer as unknown as L.Path & { toGeoJSON: () => GeoJSON.Feature | GeoJSON.FeatureCollection };
          const options = geoLayer.options;
          layers.push({ id: String(id), type: "geojson", data: geoLayer.toGeoJSON(), color: options.color, fillColor: options.fillColor, opacity: options.fillOpacity });
        }
      };
      map.eachLayer(visit);
      const next = JSON.stringify(layers);
      if (signature !== next) { signature = next; onLayers(layers); }
    };
    sync();
    map.on("layeradd layerremove", sync);
    // Leaflet has no opacity-changed event; sample layer state only while 3D is open.
    const timer = window.setInterval(sync, 750);
    return () => { map.off("layeradd layerremove", sync); clearInterval(timer); };
  }, [enabled, map, basemaps, onLayers]);
  return null;
}

export function LeafletUserLocation({ active }: { active: boolean }) {
  const map = useMap();
  const location = useUserGeolocation();
  const revision = useRef(location.revision);
  useEffect(() => {
    if (!map.getPane("user-location")) { const pane = map.createPane("user-location"); pane.style.zIndex = "650"; }
    if (location.latitude === null || location.longitude === null || !location.visible) return;
    const point: L.LatLngTuple = [location.latitude, location.longitude];
    const circle = L.circle(point, { pane: "user-location", radius: Math.max(1, location.accuracy ?? 1), color: "#1e90ff", weight: 1, fillOpacity: 0.15 }).addTo(map);
    const marker = L.circleMarker(point, { pane: "user-location", radius: 7, color: "white", weight: 3, fillColor: "#1e90ff", fillOpacity: 1 }).addTo(map);
    if (active && revision.current !== location.revision) { revision.current = location.revision; map.flyTo(point, 16); }
    return () => { map.removeLayer(circle); map.removeLayer(marker); };
  }, [map, active, location.latitude, location.longitude, location.accuracy, location.visible, location.revision]);
  return null;
}
