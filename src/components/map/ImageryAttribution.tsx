import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useBasemapContext } from "./BasemapContext";
import { escapeAttributionHtml, fetchGoogleViewportCopyright } from "@/services/googleMapsTiles";

/**
 * Leaflet's default AttributionControl (bottom-right, auto-created by
 * react-leaflet's MapContainer) already aggregates every active layer's
 * `attribution` prop - basemap credit plus per-layer ones like result tiles'
 * "Google Earth Engine". Reimplementing that aggregation to build a fully
 * custom control would risk silently dropping a required credit line, so
 * this instead enhances the SAME control in place, via its public
 * `getContainer()`:
 *  - click-to-expand instead of permanently single-line-truncated (see
 *    `.savegeo-attribution` / `-expanded` in app.css)
 * Leaflet's built-in control remains responsible for collecting attribution
 * from visible layers.
 */
export default function ImageryAttribution() {
  const map = useMap();
  const { activeBasemapId } = useBasemapContext();

  useEffect(() => {
    const container = map.attributionControl?.getContainer();
    if (!container) return;

    container.classList.add("savegeo-attribution");
    const toggle = () => container.classList.toggle("savegeo-attribution-expanded");
    container.addEventListener("click", toggle);

    return () => {
      container.removeEventListener("click", toggle);
    };
  }, [map]);

  useEffect(() => {
    if (activeBasemapId !== "google-satellite") return;

    let cancelled = false;
    let requestId = 0;
    let currentAttribution: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const id = ++requestId;
        const bounds = map.getBounds();
        const copyright = await fetchGoogleViewportCopyright({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        }, map.getZoom());
        if (cancelled || id !== requestId) return;

        const nextAttribution = copyright ? escapeAttributionHtml(copyright) : null;
        if (nextAttribution === currentAttribution) return;
        const control = map.attributionControl;
        if (currentAttribution) control?.removeAttribution(currentAttribution);
        currentAttribution = nextAttribution;
        if (nextAttribution) control?.addAttribution(nextAttribution);
      }, 200);
    };

    refresh();
    map.on("moveend", refresh);
    map.on("zoomend", refresh);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      map.off("moveend", refresh);
      map.off("zoomend", refresh);
      if (currentAttribution) map.attributionControl?.removeAttribution(currentAttribution);
    };
  }, [map, activeBasemapId]);

  return null;
}
