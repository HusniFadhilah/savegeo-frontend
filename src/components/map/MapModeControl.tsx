import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export default function MapModeControl({ mode, onChange }: { mode: "flat" | "globe"; onChange: (mode: "flat" | "globe") => void }) {
  const map = useMap();
  useEffect(() => {
    const control = new L.Control({ position: "topleft" });
    const change = () => onChange(mode === "flat" ? "globe" : "flat");
    control.onAdd = () => {
      const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control map-mode-control");
      const button = L.DomUtil.create("a", "map-mode-trigger", wrapper) as HTMLAnchorElement;
      button.href = "#";
      button.innerHTML = mode === "flat" ? '<i class="bi bi-globe-americas"></i>' : '<i class="bi bi-map"></i>';
      button.title = mode === "flat" ? "Beralih ke globe" : "Beralih ke flat map";
      button.setAttribute("aria-label", button.title);
      L.DomEvent.on(button, "click", (event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        change();
      });
      L.DomEvent.disableClickPropagation(wrapper);
      return wrapper;
    };
    control.addTo(map);
    return () => { map.removeControl(control); };
  }, [map, mode, onChange]);
  return null;
}
