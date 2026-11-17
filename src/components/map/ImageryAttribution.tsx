import { useI18nStore } from "@/hooks/useI18nStore";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { useBasemapContext } from "./BasemapContext";
import { fetchEsriImageryDate } from "@/services/esriImageryDate";
import { escapeAttributionHtml, fetchGoogleViewportCopyright } from "@/services/googleMapsTiles";

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
  const t = useI18nStore(s => s.t);
  const { activeBasemapId, historicalImageryDate } = useBasemapContext();
  const dateTextRef = useRef<string | null>(null);
  const dateElRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const container = map.attributionControl?.getContainer();
    if (!container) return;

    container.classList.add("savegeo-attribution");
    const toggle = () => container.classList.toggle("savegeo-attribution-expanded");
    container.addEventListener("click", toggle);

    const dateEl = document.createElement("button");
    dateEl.type = "button";
    dateEl.style.cssText = "display:block;border:0;background:transparent;color:inherit;font:inherit;text-align:left";
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

    let requestId = 0;
    const dateEl = dateElRef.current;
    const show = (text: string) => {
      dateTextRef.current = text;
      if (!dateEl) return;
      dateEl.textContent = text;
      const container = map.attributionControl?.getContainer();
      if (container && !container.contains(dateEl)) container.appendChild(dateEl);
    };
    const update = () => {
      requestId += 1;
      show(t("map.imageryDateAction"));
    };
    const requestDate = (event: MouseEvent) => {
      event.stopPropagation();
      const id = ++requestId;
      const center = map.getCenter();
      fetchEsriImageryDate(center.lat, center.lng, map.getZoom()).then(date => {
        if (id !== requestId) return;
        show(date ? t("map.imageryDate", { date }) : t("map.imageryDateNone"));
      });
    };
    update();
    dateEl?.addEventListener("click", requestDate);
    map.on("moveend", update);
    return () => {
      requestId += 1;
      map.off("moveend", update);
      dateEl?.removeEventListener("click", requestDate);
    };
  }, [map, activeBasemapId, historicalImageryDate, t]);

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
