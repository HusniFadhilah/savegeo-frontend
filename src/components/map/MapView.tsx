import { useEffect, useRef, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useBasemaps } from "@/hooks/useBasemaps";
import FullscreenControl from "@/components/map/FullscreenControl";
import ImageryAttribution from "@/components/map/ImageryAttribution";
import { BasemapContext } from "@/components/map/BasemapContext";
import { RESULT_PANE, RESULT_PANE_Z_INDEX } from "@/config/mapPanes";

const INDONESIA_CENTER: [number, number] = [-2.5, 118];
const INDONESIA_ZOOM = 5;

interface Props {
  id: string;
  children?: ReactNode;
  onMapReady?: (map: LeafletMap) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
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
export default function MapView({ id, children, onMapReady, center, zoom, className }: Props) {
  const { basemaps } = useBasemaps();
  const defaultBasemap = basemaps.find((b) => b.isDefault) ?? basemaps[0];

  // Tracks which basemap this map instance is showing, for ImageryAttribution
  // (satellite capture-date lookup) - defaults to whatever's actually
  // rendered below even when no <BasemapSwitcher/> child is present to write
  // it explicitly (e.g. SwipeCompareMap never renders one).
  const [activeBasemapId, setActiveBasemapId] = useState<string | null>(null);
  useEffect(() => {
    if (defaultBasemap && activeBasemapId === null) setActiveBasemapId(defaultBasemap.id);
  }, [defaultBasemap, activeBasemapId]);

  return (
    <BasemapContext.Provider value={{ activeBasemapId, setActiveBasemapId }}>
      <MapContainer
        id={id}
        center={center ?? INDONESIA_CENTER}
        zoom={zoom ?? INDONESIA_ZOOM}
        className={className ?? "savegeo-map"}
        preferCanvas
      >
        {defaultBasemap && (
          <TileLayer url={defaultBasemap.url} attribution={defaultBasemap.attribution} maxZoom={defaultBasemap.maxZoom} />
        )}
        <InvalidateOnResize />
        <ReadyNotifier onMapReady={onMapReady} />
        <ResultPaneSetup />
        <FullscreenControl />
        <ImageryAttribution />
        {children}
      </MapContainer>
    </BasemapContext.Provider>
  );
}
