import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/**
 * Live lat/lng readout for the cursor position, added as a real Leaflet
 * control (bottomright) so it stacks above the attribution strip instead of
 * floating over it - controls added after map init land above whatever's
 * already anchored to that corner (see FullscreenControl for the same
 * pattern, topleft instead).
 */
export default function MapCursorPosition() {
  const map = useMap();

  useEffect(() => {
    const control = new L.Control({ position: "bottomright" });
    let el: HTMLDivElement;

    control.onAdd = () => {
      el = L.DomUtil.create("div", "leaflet-control map-cursor-pos");
      el.textContent = "—";
      return el;
    };
    control.addTo(map);

    const onMove = (e: L.LeafletMouseEvent) => {
      el.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    };
    const onLeave = () => {
      el.textContent = "—";
    };

    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);

    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onLeave);
      map.removeControl(control);
    };
  }, [map]);

  return null;
}
