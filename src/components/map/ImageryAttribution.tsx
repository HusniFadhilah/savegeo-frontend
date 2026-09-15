import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { useBasemapContext } from "./BasemapContext";
import { fetchEsriImageryDate } from "@/services/esriImageryDate";

const SATELLITE_BASEMAP_ID = "satellite";

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
 *  - while the satellite basemap is active, an Esri imagery capture-date
 *    lookup for the current map center, appended as an extra row - Esri
 *    World Imagery is a location-varying mosaic, not one global date, so
 *    this re-queries on every `moveend`, not just once.
 * A MutationObserver keeps the injected date row alive across Leaflet's own
 * internal re-renders of the control (it replaces the container's
 * innerHTML on every add/removeAttribution call, e.g. a result tile layer
 * toggling visibility).
 */
export default function ImageryAttribution() {
  const map = useMap();
  const { activeBasemapId, historicalImageryDate } = useBasemapContext();
  const dateTextRef = useRef<string | null>(null);
  const dateElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = map.attributionControl?.getContainer();
    if (!container) return;

    container.classList.add("savegeo-attribution");
    const toggle = () => container.classList.toggle("savegeo-attribution-expanded");
    container.addEventListener("click", toggle);

    const dateEl = document.createElement("div");
    dateEl.className = "savegeo-attribution-date";
    dateElRef.current = dateEl;
    const ensureAppended = () => {
      if (!dateTextRef.current) return;
      dateEl.textContent = dateTextRef.current;
      if (!container.contains(dateEl)) container.appendChild(dateEl);
    };
    ensureAppended();

    const observer = new MutationObserver(ensureAppended);
    observer.observe(container, { childList: true });

    return () => {
      container.removeEventListener("click", toggle);
      observer.disconnect();
      dateEl.remove();
      dateElRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (activeBasemapId !== SATELLITE_BASEMAP_ID || historicalImageryDate) {
      dateTextRef.current = null;
      dateElRef.current?.remove();
      return;
    }

    let cancelled = false;
    const update = () => {
      const center = map.getCenter();
      fetchEsriImageryDate(center.lat, center.lng, map.getZoom()).then((date) => {
        if (cancelled) return;
        dateTextRef.current = date ? `Citra satelit: ${date}` : null;
        const dateEl = dateElRef.current;
        if (!dateEl) return;
        if (!dateTextRef.current) {
          dateEl.remove();
          return;
        }
        dateEl.textContent = dateTextRef.current;
        const container = map.attributionControl?.getContainer();
        if (container && !container.contains(dateEl)) container.appendChild(dateEl);
      });
    };
    update();
    map.on("moveend", update);
    return () => {
      cancelled = true;
      map.off("moveend", update);
    };
  }, [map, activeBasemapId, historicalImageryDate]);

  return null;
}
