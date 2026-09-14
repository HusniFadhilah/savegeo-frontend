import { useGlobeQuery } from "./globe3d/query";
import { useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useBasemaps } from "@/hooks/useBasemaps";
import { useBasemapContext } from "./BasemapContext";
import { useI18nStore } from "@/hooks/useI18nStore";

interface ExtraBasemapOption {
  id: string;
  name: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface Props {
  extraOptions?: ExtraBasemapOption[];
}

/**
 * Layer-switcher control (top-right), mirrors legacy `addBasemapSwitcher`.
 * Collapsed into a single icon button by default - the basemap list only
 * shows on hover, so it doesn't permanently cover map content. Satellite
 * stays the layer added to the map by MapView; this control only lets the
 * user opt into Roads/others, it never changes the initial default.
 */
export default function BasemapSwitcher({ extraOptions = [] }: Props) {
  const map = useMap();
  const query = useGlobeQuery();
  const { basemaps } = useBasemaps();
  const layersRef = useRef<Record<string, L.Layer>>({});
  // Shared with ImageryAttribution (same MapView instance) via BasemapContext,
  // instead of local state - so the satellite capture-date lookup knows when
  // this map has switched away from/back to the satellite basemap.
  const { activeBasemapId: activeId, setActiveBasemapId: setActiveId } = useBasemapContext();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const t = useI18nStore((s) => s.t);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!basemaps.length) return;

    const layers: Record<string, L.Layer> = {};
    basemaps.forEach((b) => {
      const mapMaxZoom = map.getMaxZoom();
      const effectiveMaxZoom = Number.isFinite(mapMaxZoom) ? Math.max(b.maxZoom, mapMaxZoom) : b.maxZoom;
      const baseLayer = L.tileLayer(b.url, {
        className: "savegeo-basemap-layer",
        attribution: b.attribution,
        maxNativeZoom: b.maxNativeZoom ?? b.maxZoom,
        maxZoom: effectiveMaxZoom,
      });
      if (b.overlayUrl) {
        const overlayLayer = L.tileLayer(b.overlayUrl, {
          className: "savegeo-basemap-layer",
          attribution: b.overlayAttribution,
          maxNativeZoom: b.maxNativeZoom ?? b.maxZoom,
          maxZoom: effectiveMaxZoom,
        });
        layers[b.id] = L.layerGroup([baseLayer, overlayLayer]);
        return;
      }
      layers[b.id] = baseLayer;
    });
    layersRef.current = layers;

    const saved = typeof window !== "undefined" ? window.localStorage.getItem("savegeo_basemap") : null;
    const requested = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("basemap");
    const def = basemaps.find((b) => b.id === requested || b.id === saved) ?? basemaps.find((b) => b.isDefault) ?? basemaps[0];
    // MapView renders the default tile. Remove only layers explicitly marked
    // as basemap layers before installing the selected registry layer.
    map.eachLayer((layer) => {
      if ((layer as L.TileLayer).options?.className === "savegeo-basemap-layer") map.removeLayer(layer);
    });
    layers[def.id]?.addTo(map);
    setActiveId(def.id);

    return () => {
      Object.values(layers).forEach((l) => {
        if (map.hasLayer(l)) map.removeLayer(l);
      });
    };
  }, [basemaps, map, setActiveId]);

  const requestedBasemap = query.get("basemap");
  useEffect(() => {
    if (requestedBasemap && layersRef.current[requestedBasemap]) setActiveId(requestedBasemap);
  }, [requestedBasemap, setActiveId]);
  useEffect(() => {
    const selected = activeId && layersRef.current[activeId];
    if (!selected) return;
    Object.values(layersRef.current).forEach(layer => { if (layer !== selected && map.hasLayer(layer)) map.removeLayer(layer); });
    if (!map.hasLayer(selected)) selected.addTo(map);
  }, [activeId, map]);

  const switchTo = (id: string) => {
    const layers = layersRef.current;
    if (!layers[id] || id === activeId) return;
    if (activeId && layers[activeId] && map.hasLayer(layers[activeId])) {
      map.removeLayer(layers[activeId]);
    }
    layers[id].addTo(map);
    setActiveId(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("savegeo_basemap", id);
      const params = new URLSearchParams(window.location.search); params.set("basemap", id);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
    }
    setOpen(false);
  };

  if (!basemaps.length) return null;

  return (
    <div className="leaflet-top leaflet-right basemap-switcher-control">
      <div ref={rootRef}
        className="leaflet-control leaflet-bar basemap-switcher"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button type="button" className="basemap-trigger" title={t("map.basemap.title")} aria-label={t("map.basemap.title")} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <i className="bi bi-stack" />
        </button>
        {open && (
          <div className="basemap-panel" role="listbox" aria-label={t("map.basemap.title")}>
            {basemaps.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`basemap-option ${activeId === b.id ? "active" : ""}`}
                aria-selected={activeId === b.id}
                role="option"
                onClick={() => switchTo(b.id)}
              >
                {t(`map.basemap.${b.id === "satellite_roads" ? "satelliteRoads" : b.id === "topo" ? "topographic" : b.id === "terrain" ? "terrainRelief" : b.id}`) || b.name}
              </button>
            ))}
            {extraOptions.length > 0 && <div className="basemap-panel-divider" />}
            {extraOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`basemap-option ${option.active ? "active" : ""}`}
                disabled={option.disabled}
                onClick={() => {
                  option.onClick();
                  setOpen(false);
                }}
              >
                {option.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
