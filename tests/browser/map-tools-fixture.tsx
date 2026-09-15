import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TileLayer } from "react-leaflet";
import MapView from "../../src/components/map/MapView";
import AoiDrawingTools from "../../src/components/map/AoiDrawingTools";
import BasemapSwitcher from "../../src/components/map/BasemapSwitcher";
import { RESULT_PANE } from "../../src/config/mapPanes";
import type { AoiFeature } from "../../src/types/map";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../../src/styles/app.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Fixture() {
  const [aoi, setAoi] = useState<AoiFeature | null>(null);
  return <><h1>Map tools verification</h1><output aria-label="AOI status">{aoi ? "AOI selected" : "No AOI"}</output>
    <MapView id="tools-map"><BasemapSwitcher /><AoiDrawingTools onChange={setAoi} />
      <TileLayer url="/test-result/{z}/{x}/{y}.png" pane={RESULT_PANE} opacity={0.3} />
    </MapView></>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={client}><Fixture /></QueryClientProvider></React.StrictMode>);
