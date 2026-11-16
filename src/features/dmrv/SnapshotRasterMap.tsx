import { useEffect } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import ResultTileLayer from "@/components/map/ResultTileLayer";
import MapLegend from "@/components/map/MapLegend";
import type { SnapshotLayer } from "./snapshotPresentation";

type Aoi = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
function FitBoundary({ aoi }: { aoi: Aoi | null }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const bounds = L.geoJSON(aoi).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [aoi, map]);
  return aoi ? (
    <GeoJSON data={aoi} style={{ color: "#f44336", weight: 2, fillOpacity: 0 }} />
  ) : null;
}
export default function SnapshotRasterMap({
  snapshotId,
  layer,
  aoi,
}: {
  snapshotId: string;
  layer: SnapshotLayer;
  aoi: Aoi | null;
}) {
  return (
    <div className="position-relative">
      <MapView id={`snapshot-${snapshotId}`}>
        <FitBoundary aoi={aoi} />
        <ResultTileLayer
          layerKey={`${snapshotId}:${layer.key}`}
          tileUrl={layer.url}
          opacity={0.85}
          clipGeometry={aoi}
          resolutionM={layer.resolution}
        />
      </MapView>
      <MapLegend
        title={layer.key}
        entries={layer.entries}
        scale={
          layer.min !== undefined && layer.max !== undefined && layer.colors.length > 1
            ? { min: layer.min, max: layer.max, unit: layer.unit, colors: layer.colors }
            : undefined
        }
      />
    </div>
  );
}
