import { useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useBasemaps } from "@/hooks/useBasemaps";
import { useBasemapContext } from "./BasemapContext";

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
  const { basemaps } = useBasemaps();
  const layersRef = useRef<Record<string, L.TileLayer>>({});
  // Shared with ImageryAttribution (same MapView instance) via BasemapContext,
  // instead of local state - so the satellite capture-date lookup knows when
  // this map has switched away from/back to the satellite basemap.
  const { activeBasemapId: activeId, setActiveBasemapId: setActiveId } = useBasemapContext();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!basemaps.length) return;

    const layers: Record<string, L.TileLayer> = {};
    basemaps.forEach((b) => {
      layers[b.id] = L.tileLayer(b.url, { attribution: b.attribution, maxZoom: b.maxZoom });
    });
    layersRef.current = layers;

    const def = basemaps.find((b) => b.isDefault) ?? basemaps[0];
    setActiveId(def.id);

    return () => {
      Object.values(layers).forEach((l) => {
        if (map.hasLayer(l)) map.removeLayer(l);
      });
    };
  }, [basemaps, map, setActiveId]);

  const switchTo = (id: string) => {
    const layers = layersRef.current;
    if (!layers[id] || id === activeId) return;
    if (activeId && layers[activeId] && map.hasLayer(layers[activeId])) {
      map.removeLayer(layers[activeId]);
    }
    layers[id].addTo(map);
    setActiveId(id);
    setOpen(false);
  };

  if (!basemaps.length) return null;

  return (
    <div className="leaflet-top leaflet-right basemap-switcher-control">
      <div
        className="leaflet-control leaflet-bar basemap-switcher"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button type="button" className="basemap-trigger" title="Ganti basemap">
          <i className="bi bi-stack" />
        </button>
        {open && (
          <div className="basemap-panel">
            {basemaps.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`basemap-option ${activeId === b.id ? "active" : ""}`}
                onClick={() => switchTo(b.id)}
              >
                {b.name}
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
