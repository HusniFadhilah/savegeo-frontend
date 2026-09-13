// Development-only browser fixture. Uses production Leaflet components and
// deterministic tile responses supplied by swipe-check.cjs, never live data.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useMap } from "react-leaflet";
import L from "leaflet";
import SwipeCompareMap from "../../src/components/map/SwipeCompareMap";
import SatelliteViewer from "../../src/features/disaster/components/SatelliteViewer";
import BeforeAfterMaps from "../../src/features/lc-change/components/BeforeAfterMaps";
import ResultsMapPanel from "../../src/features/carbon/components/ResultsMapPanel";
import ImageryModule from "../../src/features/imagery/ImageryModule";
import { useAoiStore } from "../../src/hooks/useAoiStore";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../src/styles/legacy-base.css";
import "../../src/styles/app.css";

const tile = (name: string) => `${location.origin}/test-tiles/${name}/{z}/{x}/{y}.png`;
const outer = [[-30, -20], [30, -20], [30, 20], [-30, 20], [-30, -20]];
const hole = [[-4, -4], [-4, 4], [4, 4], [4, -4], [-4, -4]];
const feature = (shift = 0, holes = false) => ({ type: "Feature", properties: {}, geometry: {
  type: "Polygon", coordinates: [outer, ...(holes ? [hole] : [])].map(r => r.map(([x,y]) => [x + shift, y])),
} } as GeoJSON.Feature<GeoJSON.Polygon>);
function ExposeMap() {
  const map = useMap();
  useEffect(() => { window.testMap = map; return () => { delete window.testMap; }; }, [map]);
  return null;
}
function Fixture() {
  const module = new URLSearchParams(location.search).get("module") || "shared";
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [aoi, setAoi] = useState(() => feature(0, module === "shared"));
  const [after, setAfter] = useState<string | null>(tile("after"));
  const [opacity, setOpacity] = useState(1);
  const [mode, setMode] = useState("classes");
  const [clip, setClip] = useState(true);
  const before = tile("before");
  useEffect(() => {
    if(module === "imagery") useAoiStore.getState().setAoi({feature:aoi,bounds:L.geoJSON(aoi).getBounds(),name:"Test AOI",source:"drawn",areaKm2:1});
  },[aoi,module]);
  return <div style={{ padding: 16 }}>
    <div className="mb-2">
      <button onClick={() => setAoi(feature(10, module === "shared"))}>Change AOI</button>
      <button onClick={() => setAfter(tile("alternate"))}>Change layer</button>
      <button onClick={() => setAfter(null)}>Missing layer</button>
      <button onClick={() => setAfter(tile("error"))}>Failed layer</button>
      <button onClick={() => setOpacity(.4)}>Opacity 40%</button>
      <button onClick={() => setClip(v => !v)}>Toggle AOI clipping</button>
    </div>
    {module === "imagery" ? <ImageryModule /> : module === "disaster" ? <SatelliteViewer aoi={{ id: 1, geojson: aoi } as any}
      imagery={{pre: [{id: 1, preview_tile_url: before, satellite: "Local", acquisition_date: "2024-01-01", source_kind: "local_upload", resolution_m: 30}],
        post: [{id: 2, preview_tile_url: after, satellite: "GEE", acquisition_date: "2025-01-01", resolution_m: 10}]} as any}
      primaryImagery={{pre: {id: 1}, post: {id: 2}} as any} />
    : module === "land-cover-change" ? <BeforeAfterMaps aoi={aoi} onAoiChange={setAoi as any} dataset="test" yearA={2020} yearB={2025}
      yearData={{2020: {tile_url: before, classes: {}, total_area_ha: 1, year: 2020}, 2025: {tile_url: after, classes: {}, total_area_ha: 1, year: 2025}}}
      mode={mode as any} onModeChange={setMode} changeMapData={{changed_tile_url: tile("changed"), destination_tile_url: tile("destination")} as any}
      changeMapLoading={false} changeMapError={null} />
    : module === "carbon-estimation" ? <ResultsMapPanel aoi={{feature: aoi, bounds: L.geoJSON(aoi).getBounds()} as any} zoom={3}
      results={{carbon: {carbon_estimated: {tile_url: before}, carbon_reference: {tile_url: after}}} as any}
      visMin={0} visMax={100} visPalette={["#000", "#fff"]} legendBins={2} showReference mapKey="test" />
    : <SwipeCompareMap id="testSwipe" beforeUrl={before} afterUrl={after} center={[0,0]} zoom={3}
      bounds={clip ? L.geoJSON(aoi).getBounds() : undefined} clipGeometry={clip ? aoi : null} opacity={opacity}
      orientation={orientation} onOrientationChange={setOrientation} beforeMaxNativeZoom={3} afterMaxNativeZoom={2}>
      <ExposeMap />
    </SwipeCompareMap>}
  </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><Fixture /></React.StrictMode>);
