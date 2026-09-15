import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ImageryToolsPanel from "../../src/features/imagery/ImageryToolsPanel";
import type { AoiFeature } from "../../src/types/map";
import type { ImageryScene } from "../../src/features/imagery/types";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../../src/styles/app.css";
import { useI18nStore } from "../../src/hooks/useI18nStore";

const aoi: AoiFeature = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } };
const scene: ImageryScene = { id: "fixture-scene", acquired_at: "2026-01-01T00:00:00Z", cloud_cover_pct: 0, assets: [] };
const client = new QueryClient();
useI18nStore.getState().setLanguage("id");
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><ImageryToolsPanel scene={scene} aoi={aoi} assetKey="visual" onNasaLayer={() => undefined} onStory={() => undefined} /></QueryClientProvider>);
