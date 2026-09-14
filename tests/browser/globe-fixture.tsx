/* Development-only fixture. Synthetic AOI/analysis geometry is explicitly test data. */
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { GeoJSON, TileLayer } from "react-leaflet";
import type { Viewer } from "cesium";
import GlobeView from "../../src/components/map/GlobeView";
import MapView from "../../src/components/map/MapView";
import BasemapSwitcher from "../../src/components/map/BasemapSwitcher";
import { useLocationStore } from "../../src/hooks/useUserGeolocation";
import { useI18nStore } from "../../src/hooks/useI18nStore";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../../src/styles/app.css";
const aoi: GeoJSON.Feature<GeoJSON.MultiPolygon> = { type: "Feature", properties: { name: "TEST AOI", area_km2: 100 }, geometry: { type: "MultiPolygon", coordinates: [[[[117,-3],[118,-3],[118,-2],[117,-2],[117,-3]]], [[[119,-3],[120,-3],[120,-2],[119,-2],[119,-3]]]] } };
const hotspot: GeoJSON.Feature = { type: "Feature", properties: { name: "TEST hotspot", confidence: 90 }, geometry: { type: "Point", coordinates: [118,-2.5] } };
declare global { interface Window { testViewer?: Viewer; viewerCreations: number; locationState: typeof useLocationStore; } }
window.viewerCreations = 0; window.locationState = useLocationStore;
useI18nStore.getState().setLanguage("en");
export function Fixture() {
  const [mounted, setMounted] = useState(true);
  const [opacity, setOpacity] = useState(0.6);
  const [flat, setFlat] = useState(false);
  const bridge = new URLSearchParams(window.location.search).has("bridge");
  const layers = useMemo(() => [{ id: "analysis", type: "raster" as const, url: `${window.location.origin}/test-analysis/{z}/{x}/{y}.png`, opacity }, { id: "hotspot", type: "geojson" as const, data: hotspot }], [opacity]);
  return <><button onClick={() => setMounted(v => !v)}>Mount/unmount</button><label>Analysis opacity<input aria-label="Analysis opacity" type="range" min="0" max="1" step="0.1" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>
  {mounted && (bridge || flat ? <MapView id="bridge-map"><BasemapSwitcher /><GeoJSON data={aoi} /><GeoJSON data={hotspot} /><TileLayer url={layers[0].type === "raster" ? layers[0].url : ""} opacity={opacity} /></MapView> : <GlobeView id="test-globe" aoi={aoi} layers={layers} onReady={v => { window.testViewer = v; window.viewerCreations++; }} onViewChange={() => setFlat(true)} />)}</>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Fixture /></React.StrictMode>);
