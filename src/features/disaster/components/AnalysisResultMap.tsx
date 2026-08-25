import { useEffect } from "react";
import { GeoJSON, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import { RESULT_PANE } from "@/config/mapPanes";
import type {
  DisasterAnalysisEntry,
  DisasterAoiRecord,
  DisasterSatelliteLayers,
  HotspotRecord,
} from "../types";

const AOI_STYLE = { color: "#1565c0", weight: 2, fill: false };
const HOTSPOT_STYLE = { color: "#e53935", weight: 2, fillOpacity: 0.25 };
const HOTSPOT_HIGHLIGHT_STYLE = { color: "#ffb300", weight: 4, fillOpacity: 0.35 };

function FitToFeature({
  feature,
  signal,
}: {
  feature: GeoJSON.Feature | GeoJSON.Geometry | null;
  signal: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!feature) return;
    const geom =
      feature.type === "Feature"
        ? feature
        : { type: "Feature" as const, properties: {}, geometry: feature };
    const bounds = L.geoJSON(geom as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
  return null;
}

interface Props {
  aoi: DisasterAoiRecord | null;
  showAoi: boolean;
  satellite: DisasterSatelliteLayers | null;
  showSatellite: boolean;
  analyses: DisasterAnalysisEntry[];
  checkedAnalyses: Set<string>;
  hotspots: HotspotRecord[];
  showHotspots: boolean;
  highlightedHotspotId: number | null;
  onHotspotClick?: (hotspotId: number) => void;
  /** Bumped by the parent to re-fit the map (AOI on load, or a specific hotspot on "Zoom"). */
  focusFeature: GeoJSON.Feature | GeoJSON.Geometry | null;
  focusSignal: number;
}

/**
 * Item 5 of the redesign spec (D.5): MapView + one tile layer per checked
 * analysis (`result.tile_url`), plus the AOI boundary and hotspot markers as
 * optional reference layers. Legend rendering lives in the parent
 * (`DisasterDashboard`) via `MapLegend`, driven by the same `checkedAnalyses`
 * set, so it stays in sync with whatever this map actually renders.
 */
export default function AnalysisResultMap({
  aoi,
  showAoi,
  satellite,
  showSatellite,
  analyses,
  checkedAnalyses,
  hotspots,
  showHotspots,
  highlightedHotspotId,
  onHotspotClick,
  focusFeature,
  focusSignal,
}: Props) {
  return (
    <div className="disaster-result-map-shell">
      <MapView id="disasterResultMap">
        <BasemapSwitcher />

        {showSatellite && satellite?.post_tile_url && (
          <TileLayer
            url={satellite.post_tile_url}
            opacity={0.85}
            attribution="Google Earth Engine"
            pane={RESULT_PANE}
          />
        )}

        {analyses
          .filter((entry) => checkedAnalyses.has(entry.model_id) && entry.result?.tile_url)
          .map((entry) => (
            <TileLayer
              key={entry.model_id}
              url={entry.result!.tile_url!}
              opacity={0.82}
              attribution={entry.user_label}
              pane={RESULT_PANE}
            />
          ))}

        {showAoi && aoi?.geojson && (
          <GeoJSON key={`aoi-${aoi.id}`} data={aoi.geojson as GeoJSON.Feature} style={AOI_STYLE} />
        )}

        {showHotspots &&
          hotspots.map((hotspot) => (
            <GeoJSON
              key={`hotspot-${hotspot.id}`}
              data={hotspot.geojson as GeoJSON.Feature}
              style={hotspot.id === highlightedHotspotId ? HOTSPOT_HIGHLIGHT_STYLE : HOTSPOT_STYLE}
              eventHandlers={
                onHotspotClick ? { click: () => onHotspotClick(hotspot.id) } : undefined
              }
            />
          ))}

        <FitToFeature feature={focusFeature} signal={focusSignal} />
      </MapView>
    </div>
  );
}
