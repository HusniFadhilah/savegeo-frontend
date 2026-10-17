import { useGlobeQuery, writeGlobeQuery } from "./globe3d/query";
import { useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useBasemaps } from "@/hooks/useBasemaps";
import { useBasemapContext } from "./BasemapContext";
import { useI18nStore } from "@/hooks/useI18nStore";
import { BASEMAP_REFERENCE_PANE } from "@/config/mapPanes";
import { SATELLITE_BASEMAP_GROUPS, SATELLITE_BASEMAP_IDS, satelliteBasemapGroupId } from "@/config/satelliteBasemapGroups";
import { safeMapZoom, safeTileSize, safeZoomOffset } from "./mapViewValidation";

interface ExtraBasemapOption {
  id: string;
  name: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface Props {
  extraOptions?: ExtraBasemapOption[];
  enhanceSatelliteImagery?: boolean;
}

/**
 * Layer-switcher control (top-right), mirrors legacy `addBasemapSwitcher`.
 * Collapsed into a single icon button by default. Click toggles the panel;
 * pointer movement never changes its open state. Satellite stays the layer
 * added to the map by MapView; this control only lets the user opt into
 * Roads/others, it never changes the initial default.
 */
export default function BasemapSwitcher({ extraOptions = [], enhanceSatelliteImagery = false }: Props) {
  const map = useMap();
  const query = useGlobeQuery();
  const { basemaps } = useBasemaps();
  const layersRef = useRef<Record<string, L.Layer>>({});
  // Shared with ImageryAttribution (same MapView instance) via BasemapContext,
  // instead of local state - so the satellite capture-date lookup knows when
  // this map has switched away from/back to the satellite basemap.
  const { activeBasemapId: activeId, setActiveBasemapId: setActiveId } = useBasemapContext();
  const [open, setOpen] = useState(false);
  const [expandedSatelliteGroup, setExpandedSatelliteGroup] = useState<string | null>("esri");
  const rootRef = useRef<HTMLDivElement>(null);
  const t = useI18nStore((s) => s.t);
  const googleBasemapAvailable = basemaps.some((basemap) => basemap.id === "google-satellite");
  const googleUnavailableKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
    ? "map.basemap.google-unavailable"
    : "map.basemap.google-key-required";
  const satelliteBasemaps = basemaps.filter((basemap) => SATELLITE_BASEMAP_IDS.has(basemap.id));
  const otherBasemaps = basemaps.filter((basemap) => !SATELLITE_BASEMAP_IDS.has(basemap.id));
  const satelliteGroups = SATELLITE_BASEMAP_GROUPS.map((group) => ({
    ...group,
    items: satelliteBasemaps.filter((basemap) => group.basemapIds.some((id) => id === basemap.id)),
  })).filter((group) => group.items.length > 0 || group.id === "google");
  const basemapLabel = (id: string) => t(`map.basemap.${id === "satellite_roads" ? "satelliteRoads" : id === "topo" ? "topographic" : id === "terrain" ? "terrainRelief" : id}`);
  useEffect(() => {
    const container = map.getContainer();
    container.classList.toggle("savegeo-enhance-satellite-basemap", enhanceSatelliteImagery);
    return () => container.classList.remove("savegeo-enhance-satellite-basemap");
  }, [enhanceSatelliteImagery, map]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    const groupId = satelliteBasemapGroupId(activeId);
    if (groupId) setExpandedSatelliteGroup(groupId);
  }, [activeId]);
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
      const maxZoom = safeMapZoom(b.maxZoom, 22, 22);
      const mapMaxZoom = safeMapZoom(map.getMaxZoom(), 22, 22);
      const effectiveMaxZoom = Math.max(maxZoom, mapMaxZoom);
      const maxNativeZoom = safeMapZoom(b.maxNativeZoom ?? b.maxZoom, effectiveMaxZoom, effectiveMaxZoom);
      const baseLayer = L.tileLayer(b.url, {
        className: `savegeo-basemap-layer${SATELLITE_BASEMAP_IDS.has(b.id) ? " savegeo-satellite-imagery-layer" : ""}`,
        attribution: b.attribution,
        tileSize: safeTileSize(b.tileSize),
        zoomOffset: safeZoomOffset(b.zoomOffset),
        maxNativeZoom,
        maxZoom: effectiveMaxZoom,
      });
      if (b.overlayUrl) {
        const overlayLayer = L.tileLayer(b.overlayUrl, {
          className: "savegeo-basemap-layer",
          attribution: b.overlayAttribution,
          maxNativeZoom,
          maxZoom: effectiveMaxZoom,
          pane: BASEMAP_REFERENCE_PANE,
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
      const classNames = (layer as L.TileLayer).options?.className?.split(/\s+/) ?? [];
      if (classNames.includes("savegeo-basemap-layer")) map.removeLayer(layer);
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
      writeGlobeQuery({ basemap: id });
    }
    setOpen(false);
  };

  if (!basemaps.length) return null;

  return (
    <div className="leaflet-top leaflet-right basemap-switcher-control">
      <div ref={rootRef}
        className="leaflet-control leaflet-bar basemap-switcher"
      >
        <button type="button" className="basemap-trigger" title={t("map.basemap.title")} aria-label={t("map.basemap.title")} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <i className="bi bi-stack" />
        </button>
        {open && (
          <div className="basemap-panel" role="listbox" aria-label={t("map.basemap.title")}>
            <div className="basemap-panel-heading" role="presentation">{t("map.basemap.satelliteSources")}</div>
            {satelliteGroups.map((group) => <details key={group.id} className="basemap-provider-group" role="group" aria-label={group.label}
              open={expandedSatelliteGroup === group.id}
              onToggle={(event) => {
                const nextOpen = event.currentTarget.open;
                setExpandedSatelliteGroup((current) => nextOpen ? group.id : current === group.id ? null : current);
              }}>
              <summary>{group.label}<i className="bi bi-chevron-down" aria-hidden="true" /></summary>
              {group.items.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`basemap-option ${activeId === b.id ? "active" : ""}`}
                  aria-selected={activeId === b.id}
                  role="option"
                  onClick={() => switchTo(b.id)}
                >
                  {basemapLabel(b.id) || b.name}
                </button>
              ))}
              {group.id === "google" && !googleBasemapAvailable && <button
                  type="button"
                  className="basemap-option"
                  role="option"
                  aria-disabled="true"
                  disabled
                  title={t(googleUnavailableKey)}
                >{t(googleUnavailableKey)}</button>}
            </details>)}
            <div className="basemap-panel-divider" role="presentation" />
            <div className="basemap-panel-heading" role="presentation">{t("map.basemap.otherBasemaps")}</div>
            {otherBasemaps.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`basemap-option ${activeId === b.id ? "active" : ""}`}
                aria-selected={activeId === b.id}
                role="option"
                onClick={() => switchTo(b.id)}
              >
                {basemapLabel(b.id) || b.name}
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
