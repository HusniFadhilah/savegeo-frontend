import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { useI18nStore } from "@/hooks/useI18nStore";

/**
 * Native Fullscreen API toggle, added as a real Leaflet control (topleft)
 * so it stacks correctly with the zoom control and any draw toolbar already
 * occupying that corner, instead of overlapping them.
 */
export default function FullscreenControl() {
  const map = useMap();
  const language = useI18nStore((state) => state.language);
  const t = useI18nStore.getState().t;

  useEffect(() => {
    const container = map.getContainer();

    const control = new L.Control({ position: "topleft" });
    control.onAdd = () => {
      const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const link = L.DomUtil.create("a", "fullscreen-control-btn", wrapper) as HTMLAnchorElement;
      link.href = "#";
      link.title = t("map.fullscreen");
      link.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';

      L.DomEvent.on(link, "click", (e) => {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          container.requestFullscreen();
        }
      });
      L.DomEvent.disableClickPropagation(wrapper);

      return wrapper;
    };
    control.addTo(map);

    const updateIcon = () => {
      const icon = control.getContainer()?.querySelector("i");
      if (!icon) return;
      const isFs = document.fullscreenElement === container;
      icon.className = isFs ? "bi bi-fullscreen-exit" : "bi bi-arrows-fullscreen";
      const link = control.getContainer()?.querySelector(".fullscreen-control-btn");
      link?.setAttribute("title", isFs ? t("map.exitFullscreen") : t("map.fullscreen"));
    };
    document.addEventListener("fullscreenchange", updateIcon);

    return () => {
      document.removeEventListener("fullscreenchange", updateIcon);
      map.removeControl(control);
    };
  }, [language, map, t]);

  return null;
}
