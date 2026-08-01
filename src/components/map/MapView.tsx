import { useEffect, useRef, type ReactNode } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useBasemaps } from "@/hooks/useBasemaps";
import FullscreenControl from "@/components/map/FullscreenControl";

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
 * Shared Leaflet shell used by every module (AOI picker, result map,
 * disaster map, LC-change before/after maps). Satellite is always the
 * default base layer - see BasemapSwitcher / config/basemaps.ts.
 */
export default function MapView({ id, children, onMapReady, center, zoom, className }: Props) {
  const { basemaps } = useBasemaps();
  const defaultBasemap = basemaps.find((b) => b.isDefault) ?? basemaps[0];

  return (
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
      <FullscreenControl />
      {children}
    </MapContainer>
  );
}
