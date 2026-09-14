import { Component, lazy, Suspense, type ReactNode } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Viewer } from "cesium";
import { writeGlobeQuery } from "./globe3d/query";
import { useI18nStore } from "@/hooks/useI18nStore";
export type GlobeLayer =
  | { id: string; type: "raster"; url: string; opacity?: number; attribution?: string; maxZoom?: number; maxNativeZoom?: number }
  | { id: string; type: "geojson"; data: Feature<Geometry> | FeatureCollection; color?: string; fillColor?: string; opacity?: number };
export interface GlobeViewProps {
  id: string; basemapId?: string; center?: [number, number]; zoom?: number;
  aoi?: Feature | null; layers?: GlobeLayer[];
  onBasemapChange?: (id: string) => void; onReady?: (viewer: Viewer) => void;
  onCameraChange?: (camera: { lat: number; lng: number; zoom: number; bearing: number; pitch: number }) => void;
  onWebGLUnavailable?: () => void; onViewChange?: (view: "flat" | "globe") => void;
  showControls?: boolean; showAttribution?: boolean; className?: string;
}
class GlobeLoadBoundary extends Component<{ children: ReactNode; message: string; backLabel: string; back: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="savegeo-globe" role="alert">{this.props.message}<button type="button" onClick={this.props.back}>{this.props.backLabel}</button></div> : this.props.children; }
}
const Globe3DView = lazy(() => import("./Globe3DView"));
export default function GlobeView(props: GlobeViewProps) {
  const t = useI18nStore(s => s.t);
  return <GlobeLoadBoundary message={t("map.3d.loadError")} backLabel={t("map.3d.backTo2d")} back={() => { writeGlobeQuery({ view: "single" }, true); props.onViewChange?.("flat"); }}><Suspense fallback={<div className="savegeo-globe" role="status">{t("map.3d.loading")}</div>}><Globe3DView {...props} /></Suspense></GlobeLoadBoundary>;
}
