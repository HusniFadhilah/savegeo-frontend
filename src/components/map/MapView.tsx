import { MapActivityContext } from "./MapActivityContext";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useBasemaps } from "@/hooks/useBasemaps";
import FullscreenControl from "@/components/map/FullscreenControl";
import ImageryAttribution from "@/components/map/ImageryAttribution";
import HistoricalImageryControl from "./HistoricalImageryControl";
import ZoomScaleControl from "@/components/map/ZoomScaleControl";
import { BasemapContext } from "@/components/map/BasemapContext";
import { RESULT_PANE, RESULT_PANE_Z_INDEX } from "@/config/mapPanes";
import { HIGH_DETAIL_MAX_ZOOM } from "@/config/mapZoom";

import GlobeView, { type GlobeLayer } from "./GlobeView";
import { GlobeLayerBridge, LeafletUserLocation } from "./GlobeLayerBridge";
import UserLocationControl from "./UserLocationControl";
import { useGlobeQuery, writeGlobeQuery } from "./globe3d/query";
import "./globe3d/globe.css";

const INDONESIA_CENTER: [number, number] = [-2.5, 118];
const INDONESIA_ZOOM = 5;

interface Props {
  id: string;
  children?: ReactNode;
  onMapReady?: (map: LeafletMap) => void;
  center?: [number, number];
  zoom?: number;
  maxZoom?: number;
  className?: string;
  /** Render the shared 3D/globe shortcut for this map instance. */
  showGlobeControl?: boolean;
  /** Analysis date used to select an Esri Wayback snapshot for the basemap. */
  historicalDate?: string;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    // Also invalidate once after mount - tab/module switches can render the
    // map while its container is display:none, which freezes tile sizing.
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => {
      observer.disconnect();
      clearTimeout(t);
    };
  }, [map]);
  return null;
}

function ReadyNotifier({ onMapReady }: { onMapReady?: (map: LeafletMap) => void }) {
  const map = useMap();
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onMapReady?.(map);
  }, [map, onMapReady]);
  return null;
}

/**
 * Creates the dedicated result-tile pane once per map, before any child can
 * try to render into it - see config/mapPanes.ts for why this exists.
 */
function ResultPaneSetup() {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane(RESULT_PANE)) {
      const pane = map.createPane(RESULT_PANE);
      pane.style.zIndex = String(RESULT_PANE_Z_INDEX);
      pane.style.pointerEvents = "none";
    }
  }, [map]);
  return null;
}

/**
 * Shared Leaflet shell used by every module (AOI picker, result map,
 * disaster map, LC-change before/after maps). Satellite is always the
 * default base layer - see BasemapSwitcher / config/basemaps.ts.
 */
export default function MapView({ id, children, onMapReady, center, zoom, maxZoom, className, showGlobeControl = true, historicalDate }: Props) {
  const { basemaps } = useBasemaps();
  const query = useGlobeQuery();
  const active = useContext(MapActivityContext);
  const globe = active && (query.get("view") === "3d" || query.get("view") === "globe");
  const [globeLayers, setGlobeLayers] = useState<GlobeLayer[]>([]);
  const globeAoi = globeLayers.find((layer) => layer.type === "geojson" && layer.data.type === "Feature" && ["Polygon", "MultiPolygon"].includes(layer.data.geometry.type));
  const analysisLayers = useMemo(() => globeLayers.filter(layer => layer !== globeAoi), [globeLayers, globeAoi]);
  const defaultBasemap = basemaps.find(b => b.id === query.get("basemap")) ?? basemaps.find((b) => b.isDefault) ?? basemaps[0];
  const effectiveMaxZoom = Math.max(maxZoom ?? 0, defaultBasemap?.maxZoom ?? 0, HIGH_DETAIL_MAX_ZOOM);
  const defaultMaxNativeZoom = defaultBasemap?.maxNativeZoom ?? defaultBasemap?.maxZoom;

  // Tracks which basemap this map instance is showing, for ImageryAttribution
  // (satellite capture-date lookup) - defaults to whatever's actually
  // rendered below even when no <BasemapSwitcher/> child is present to write
  // it explicitly (e.g. SwipeCompareMap never renders one).
  const [activeBasemapId, setActiveBasemapId] = useState<string | null>(null);
  const [historicalImageryDate, setHistoricalImageryDate] = useState<string | null>(null);
  useEffect(() => {
    if (defaultBasemap && activeBasemapId === null) setActiveBasemapId(defaultBasemap.id);
  }, [defaultBasemap, activeBasemapId]);

  return (
    <div className="map-view-shell"><div className={globe ? "map-flat-hidden" : ""}><BasemapContext.Provider value={{ activeBasemapId, setActiveBasemapId, historicalImageryDate, setHistoricalImageryDate }}>
      <MapContainer
        id={id}
        center={center ?? INDONESIA_CENTER}
        zoom={zoom ?? INDONESIA_ZOOM}
        maxZoom={effectiveMaxZoom}
        className={className ?? "savegeo-map"}
      >
        {defaultBasemap && (
          <>
            <TileLayer
              url={defaultBasemap.url}
              attribution={defaultBasemap.attribution}
              maxNativeZoom={defaultMaxNativeZoom}
              maxZoom={effectiveMaxZoom}
              className="savegeo-basemap-layer"
            />
            {defaultBasemap.overlayUrl && (
              <TileLayer
                url={defaultBasemap.overlayUrl}
                attribution={defaultBasemap.overlayAttribution}
                maxNativeZoom={defaultMaxNativeZoom}
                maxZoom={effectiveMaxZoom}
                className="savegeo-basemap-layer"
              />
            )}
          </>
        )}
        <GlobeLayerBridge enabled={globe} onLayers={setGlobeLayers} />
        {active && <LeafletUserLocation active={!globe} />}
        <InvalidateOnResize />
        <ReadyNotifier onMapReady={onMapReady} />
        <ResultPaneSetup />
        <FullscreenControl />
        <ZoomScaleControl />
        <ImageryAttribution />
        <HistoricalImageryControl enabled={active && !globe} targetDate={historicalDate} />
        {children}
      </MapContainer>
    </BasemapContext.Provider></div>
    {globe ? <div className="map-globe-overlay"><GlobeView id={`${id}-globe`} basemapId={activeBasemapId ?? undefined} center={center} zoom={zoom} aoi={globeAoi?.type === "geojson" && globeAoi.data.type === "Feature" ? globeAoi.data : null} layers={analysisLayers} onViewChange={() => writeGlobeQuery({ view: "single" })} onBasemapChange={setActiveBasemapId} /></div> :
      active && <div className="map-flat-controls">{showGlobeControl && <button type="button" onClick={() => writeGlobeQuery({ view: "3d" }, true)} aria-label="Beralih ke globe" title="Beralih ke globe">3D</button>}<UserLocationControl /></div>}
    </div>
  );
}
