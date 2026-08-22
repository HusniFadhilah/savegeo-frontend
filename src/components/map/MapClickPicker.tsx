import { useEffect, useRef } from "react";
import { useMapEvent } from "react-leaflet";
import L from "leaflet";

interface Props {
  active: boolean;
  onPick: (lat: number, lng: number) => void;
}

/**
 * Lets a caller pick a lat/lng by clicking the map - used by AoiCoordinateTab
 * so "Koordinat" isn't manual-entry-only. Only listens while `active` (the
 * parent tab is the one showing), so it doesn't steal clicks meant for
 * Leaflet.Draw (AoiDrawingTools, always mounted) on other tabs. Drops a
 * small marker at the last pick for visual feedback; the marker (and the
 * listener) is removed once the tab is no longer active.
 */
export default function MapClickPicker({ active, onPick }: Props) {
  const markerRef = useRef<L.Marker | null>(null);

  const map = useMapEvent("click", (e) => {
    if (!active) return;
    onPick(e.latlng.lat, e.latlng.lng);
    if (markerRef.current) {
      markerRef.current.setLatLng(e.latlng);
    } else {
      markerRef.current = L.marker(e.latlng, { opacity: 0.9 }).addTo(map);
    }
  });

  useEffect(() => {
    if (active) return;
    markerRef.current?.remove();
    markerRef.current = null;
  }, [active]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
