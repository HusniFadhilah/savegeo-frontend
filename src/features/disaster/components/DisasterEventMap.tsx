import { useEffect } from "react";
import { GeoJSON, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { AoiFeature } from "@/types/map";
import type { DisasterSourcesMap, DemSlopeResult, EventMapResult } from "../types";
import { RESULT_PANE } from "@/config/mapPanes";

interface Props {
  aoi: AoiFeature | null;
  sources: DisasterSourcesMap | null;
  demResult: DemSlopeResult | null;
  eventResult: EventMapResult | null;
  /** Bump this counter to re-fit the map to the AOI bounds (e.g. after a run completes). */
  fitSignal: number;
}

/** Refits the map to the AOI whenever `fitSignal` changes, mirroring the legacy map.fitBounds() calls. */
function FitToAoi({ aoi, fitSignal }: { aoi: AoiFeature | null; fitSignal: number }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const bounds = L.geoJSON(aoi as unknown as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 });
    // fitSignal is the intentional trigger; aoi is read fresh each run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);
  return null;
}

const SOURCE_OPACITY: Record<string, number> = {
  inarisk: 0.62,
  demnas: 0.48,
};

/**
 * Map-layer assembly for the disaster module, rendered as children of
 * <MapView>. Ports the imperative L.geoJSON/L.tileLayer/L.tileLayer.wms
 * calls from DisasterMapping.run()/loadOfficialSources()/loadDemSlope()
 * (main.js ~L5089-5399) to declarative react-leaflet layers so
 * add/remove/cleanup is handled by React instead of manual layer refs.
 */
export default function DisasterEventMap({ aoi, sources, demResult, eventResult, fitSignal }: Props) {
  return (
    <>
      {aoi && (
        <GeoJSON
          key={JSON.stringify(aoi.geometry)}
          data={aoi as unknown as GeoJSON.Feature}
          style={{ color: "#1565c0", weight: 2, fill: false }}
        />
      )}

      {sources &&
        Object.entries(sources).map(([key, item]) => {
          if (!item.configured) return null;
          const opacity = SOURCE_OPACITY[key] ?? 0.55;
          if (item.tile_url) {
            return <TileLayer key={key} url={item.tile_url} opacity={opacity} attribution={item.name} pane={RESULT_PANE} />;
          }
          if (item.wms_url && item.layers) {
            return (
              <WMSTileLayer
                key={key}
                url={item.wms_url}
                layers={item.layers}
                format="image/png"
                transparent
                opacity={opacity}
                attribution={item.name}
                pane={RESULT_PANE}
              />
            );
          }
          return null;
        })}

      {demResult?.tile_url && (
        <TileLayer
          url={demResult.tile_url}
          opacity={0.58}
          attribution={demResult.is_official_demnas ? "BIG DEMNAS" : "USGS SRTM fallback"}
          pane={RESULT_PANE}
        />
      )}

      {eventResult?.tile_url && (
        <TileLayer url={eventResult.tile_url} opacity={0.72} attribution={eventResult.source || "Earth Engine"} pane={RESULT_PANE} />
      )}

      <FitToAoi aoi={aoi} fitSignal={fitSignal} />
    </>
  );
}
