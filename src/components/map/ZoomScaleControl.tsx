import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";

const FEET_PER_METER = 3.28084;
const TARGET_SCALE_WIDTH_PX = 96;

function formatScale(value: number): string {
  const rounded = value >= 1000 ? Math.round(value / 1000) * 1000 : Math.round(value);
  return rounded.toLocaleString("id-ID");
}

function metersPerPixel(map: L.Map): number {
  const zoom = map.getZoom();
  const lat = map.getCenter().lat;
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 2 ** (zoom + 8);
}

function scaleDenominator(map: L.Map): number {
  return metersPerPixel(map) / 0.00028;
}

function niceDistance(meters: number): number {
  if (meters <= 0) return 0;
  const exponent = Math.floor(Math.log10(meters));
  const base = 10 ** exponent;
  const normalized = meters / base;
  const step = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;
  return step * base;
}

function formatMeters(value: number): string {
  if (value >= 1000) return `${(value / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
  if (value >= 10) return `${Math.round(value).toLocaleString("id-ID")} m`;
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })} m`;
}

function formatFeet(value: number): string {
  if (value >= 5280) return `${(value / 5280).toLocaleString("id-ID", { maximumFractionDigits: 1 })} mi`;
  if (value >= 10) return `${Math.round(value).toLocaleString("id-ID")} ft`;
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ft`;
}

function updateZoomButtonTitles(map: L.Map) {
  const zoomLabel = `Zoom ${map.getZoom()}x`;
  const container = map.getContainer();
  const zoomIn = container.querySelector<HTMLAnchorElement>(".leaflet-control-zoom-in");
  const zoomOut = container.querySelector<HTMLAnchorElement>(".leaflet-control-zoom-out");

  if (zoomIn) {
    zoomIn.title = zoomLabel;
    zoomIn.setAttribute("aria-label", `Perbesar peta, ${zoomLabel}`);
  }
  if (zoomOut) {
    zoomOut.title = zoomLabel;
    zoomOut.setAttribute("aria-label", `Perkecil peta, ${zoomLabel}`);
  }
}

export default function ZoomScaleControl() {
  const map = useMap();

  useEffect(() => {
    const control = new L.Control({ position: "bottomleft" });
    let el: HTMLDivElement | null = null;
    let barEl: HTMLDivElement | null = null;
    let distanceEl: HTMLSpanElement | null = null;
    let ratioEl: HTMLSpanElement | null = null;

    const update = () => {
      updateZoomButtonTitles(map);
      if (!barEl || !distanceEl || !ratioEl) return;

      const resolution = metersPerPixel(map);
      const distanceMeters = niceDistance(resolution * TARGET_SCALE_WIDTH_PX);
      const barWidth = Math.max(32, Math.round(distanceMeters / resolution));

      barEl.style.width = `${barWidth}px`;
      distanceEl.textContent = `${formatMeters(distanceMeters)} / ${formatFeet(distanceMeters * FEET_PER_METER)}`;
      ratioEl.textContent = `1:${formatScale(scaleDenominator(map))}`;
    };

    control.onAdd = () => {
      el = L.DomUtil.create("div", "leaflet-control map-zoom-scale");
      barEl = L.DomUtil.create("div", "map-zoom-scale__bar", el);
      const labelsEl = L.DomUtil.create("div", "map-zoom-scale__labels", el);
      distanceEl = L.DomUtil.create("span", "map-zoom-scale__distance", labelsEl);
      ratioEl = L.DomUtil.create("span", "map-zoom-scale__ratio", labelsEl);

      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
      update();
      return el;
    };

    control.addTo(map);
    updateZoomButtonTitles(map);
    map.on("zoomend moveend", update);

    return () => {
      map.off("zoomend moveend", update);
      control.remove();
    };
  }, [map]);

  return null;
}
