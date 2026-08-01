import { useEffect, useRef, type MutableRefObject } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import type { AoiFeature } from "@/types/map";

interface Props {
  onChange: (feature: AoiFeature | null) => void;
  /**
   * Optional ref the parent also holds, populated with the internal
   * FeatureGroup so it can call `setAoiOnMap(map, group, feature)` to set
   * AOI programmatically (file upload / region select / company boundary)
   * while keeping the shape editable/deletable via this component's own
   * draw controls. Backward compatible - omit for draw-only usage.
   */
  externalGroupRef?: MutableRefObject<L.FeatureGroup | null>;
}

/**
 * Polygon/rectangle AOI drawing, ported from the legacy Leaflet.Draw setup.
 * Only one AOI shape is kept at a time (drawing a new one replaces the old).
 */
export default function AoiDrawingTools({ onChange, externalGroupRef }: Props) {
  const map = useMap();
  const groupRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    groupRef.current = drawnItems;
    if (externalGroupRef) externalGroupRef.current = drawnItems;

    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        rectangle: {},
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    const emit = () => {
      const layers = drawnItems.getLayers();
      if (!layers.length) {
        onChange(null);
        return;
      }
      const geojson = drawnItems.toGeoJSON();
      const feature = (geojson as GeoJSON.FeatureCollection).features[0] as unknown as AoiFeature;
      onChange(feature ?? null);
    };

    const handleCreated = (e: L.LeafletEvent) => {
      drawnItems.clearLayers();
      drawnItems.addLayer((e as L.DrawEvents.Created).layer);
      emit();
    };
    const handleEdited = () => emit();
    const handleDeleted = () => emit();

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);
    map.on(L.Draw.Event.DELETED, handleDeleted);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.off(L.Draw.Event.DELETED, handleDeleted);
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
      if (externalGroupRef) externalGroupRef.current = null;
    };
  }, [map, onChange, externalGroupRef]);

  return null;
}

/** Replace the current AOI programmatically (e.g. from file upload/import). */
export function setAoiOnMap(map: L.Map, group: L.FeatureGroup, feature: AoiFeature) {
  group.clearLayers();
  const layer = L.geoJSON(feature as GeoJSON.Feature);
  layer.eachLayer((l) => group.addLayer(l));
  const bounds = group.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
}
