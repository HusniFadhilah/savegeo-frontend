import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import { HIGH_DETAIL_MAX_ZOOM } from "@/config/mapZoom";
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

type Ring = GeoJSON.Position[];

function featuresToAoiFeature(features: GeoJSON.Feature[]): AoiFeature | null {
  const polygons: GeoJSON.Position[][][] = [];
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      polygons.push(geometry.coordinates);
    } else if (geometry.type === "MultiPolygon") {
      polygons.push(...geometry.coordinates);
    }
  }
  if (!polygons.length) return null;
  if (polygons.length === 1) {
    return { type: "Feature", geometry: { type: "Polygon", coordinates: polygons[0] }, properties: {} };
  }
  return { type: "Feature", geometry: { type: "MultiPolygon", coordinates: polygons }, properties: {} };
}

function closeRing(ring: Ring): Ring {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, [...first]];
}

function smoothRing(ring: Ring, iterations: number): Ring {
  let current = closeRing(ring).slice(0, -1);
  if (current.length < 3) return ring;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next: Ring = [];
    current.forEach((point, index) => {
      const following = current[(index + 1) % current.length];
      const q: GeoJSON.Position = [
        point[0] * 0.75 + following[0] * 0.25,
        point[1] * 0.75 + following[1] * 0.25,
      ];
      const r: GeoJSON.Position = [
        point[0] * 0.25 + following[0] * 0.75,
        point[1] * 0.25 + following[1] * 0.75,
      ];
      next.push(q, r);
    });
    current = next;
  }

  return closeRing(current);
}

function smoothPolygonFeature(feature: AoiFeature, iterations: number): AoiFeature {
  if (iterations <= 0) return feature;
  const geometry = feature.geometry;

  if (geometry.type === "Polygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((ring) => smoothRing(ring, iterations)),
      },
    };
  }

  if (geometry.type === "MultiPolygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => smoothRing(ring, iterations))),
      },
    };
  }

  return feature;
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
        polygon: {
          allowIntersection: false,
          showArea: true,
          showLength: true,
          metric: true,
          feet: true,
          shapeOptions: {
            color: "#1f7a34",
            fillColor: "#2f9e44",
            fillOpacity: 0.18,
            weight: 3,
          },
        },
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    // Leaflet.Draw uses a raster sprite for the polygon action. The sprite
    // becomes hard to see when the application switches theme and can render
    // as an empty square in dark mode. Keep the Leaflet action/keyboard
    // handlers, but replace only its visual with a theme-safe icon font.
    const polygonButton = map.getContainer().querySelector<HTMLAnchorElement>(".leaflet-draw-draw-polygon");
    if (polygonButton) {
      polygonButton.classList.add("savegeo-draw-polygon");
      polygonButton.innerHTML = '<i class="bi bi-pentagon" aria-hidden="true"></i>';
      polygonButton.title = "Gambar polygon AOI";
      polygonButton.setAttribute("aria-label", polygonButton.title);
    }

    const updateEditToolsVisibility = () => {
      map.getContainer().classList.toggle("aoi-draw-empty", drawnItems.getLayers().length === 0);
    };
    drawnItems.on("layeradd layerremove", updateEditToolsVisibility);
    updateEditToolsVisibility();

    const emit = () => {
      const layers = drawnItems.getLayers();
      updateEditToolsVisibility();
      if (!layers.length) {
        onChange(null);
        return;
      }
      const geojson = drawnItems.toGeoJSON();
      const feature = featuresToAoiFeature((geojson as GeoJSON.FeatureCollection).features);
      onChange(feature);
    };

    const applySmoothing = (iterations: number) => {
      const layers = drawnItems.getLayers();
      if (!layers.length) return;
      const geojson = drawnItems.toGeoJSON();
      const feature = (geojson as GeoJSON.FeatureCollection).features[0] as unknown as AoiFeature | undefined;
      if (!feature || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) return;

      setAoiOnMap(map, drawnItems, smoothPolygonFeature(feature, iterations));
      emit();
    };

    const curveControl = new L.Control({ position: "topleft" });
    let smoothLevel = 0;
    curveControl.onAdd = () => {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control aoi-curve-control");
      const button = L.DomUtil.create("button", "aoi-curve-control__button", container);
      button.type = "button";
      button.title = "Haluskan sisi polygon";
      button.setAttribute("aria-label", "Haluskan sisi polygon");
      button.innerHTML = '<i class="bi bi-bezier2" aria-hidden="true"></i>';

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(button, "click", (event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        smoothLevel = smoothLevel >= 2 ? 0 : smoothLevel + 1;
        button.classList.toggle("is-active", smoothLevel > 0);
        button.title = smoothLevel === 0 ? "Haluskan sisi polygon" : `Haluskan sisi polygon level ${smoothLevel}`;
        if (smoothLevel > 0) applySmoothing(1);
      });

      return container;
    };
    map.addControl(curveControl);

    const rectangleControl = new L.Control({ position: "topleft" });
    let rectangleModeActive = false;
    let rectangleStartPoint: L.LatLng | null = null;
    let rectanglePreview: L.Rectangle | null = null;
    let rectangleButton: HTMLButtonElement | null = null;

    const rectangleStyle: L.PathOptions = {
      color: "#1f7a34",
      fillColor: "#2f9e44",
      fillOpacity: 0.16,
      weight: 3,
    };

    const rectanglePreviewStyle: L.PathOptions = {
      ...rectangleStyle,
      dashArray: "6 5",
      fillOpacity: 0.08,
    };

    const rectangleBounds = (start: L.LatLng, end: L.LatLng) =>
      L.latLngBounds([start, L.latLng(start.lat, end.lng), end, L.latLng(end.lat, start.lng)]);

    const updateRectangleButton = () => {
      if (!rectangleButton) return;
      rectangleButton.classList.toggle("is-active", rectangleModeActive);
      rectangleButton.title = rectangleModeActive
        ? "Batalkan gambar kotak"
        : "Gambar rectangle dengan klik sudut awal lalu klik sudut akhir";
      rectangleButton.setAttribute("aria-label", rectangleButton.title);
      rectangleButton.innerHTML = rectangleModeActive
        ? '<i class="bi bi-x-lg" aria-hidden="true"></i>'
        : '<i class="bi bi-square" aria-hidden="true"></i>';
    };

    const cancelRectangleMode = () => {
      rectangleModeActive = false;
      rectangleStartPoint = null;
      if (rectanglePreview) {
        map.removeLayer(rectanglePreview);
        rectanglePreview = null;
      }
      map.getContainer().classList.remove("is-drawing-rectangle");
      updateRectangleButton();
      hideDistanceTooltip();
    };

    const finishRectangle = (end: L.LatLng) => {
      if (!rectangleStartPoint) return;
      const bounds = rectangleBounds(rectangleStartPoint, end);
      if (!bounds.isValid() || rectangleStartPoint.distanceTo(end) < 2) return;
      drawnItems.clearLayers();
      drawnItems.addLayer(L.rectangle(bounds, rectangleStyle));
      emit();
      cancelRectangleMode();
    };

    rectangleControl.onAdd = () => {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control aoi-rectangle-control");
      const button = L.DomUtil.create("button", "aoi-rectangle-control__button", container);
      rectangleButton = button;
      button.type = "button";
      updateRectangleButton();

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.on(button, "click", (event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        rectangleModeActive = !rectangleModeActive;
        rectangleStartPoint = null;
        if (rectanglePreview) {
          map.removeLayer(rectanglePreview);
          rectanglePreview = null;
        }
        map.getContainer().classList.toggle("is-drawing-rectangle", rectangleModeActive);
        updateRectangleButton();
        hideDistanceTooltip();
      });

      return container;
    };
    map.addControl(rectangleControl);

    const handleCreated = (e: L.LeafletEvent) => {
      drawnItems.clearLayers();
      drawnItems.addLayer((e as L.DrawEvents.Created).layer);
      emit();
    };
    const handleEdited = () => emit();
    const handleDeleted = () => emit();
    const distanceTooltip = L.tooltip({
      className: "aoi-distance-tooltip",
      direction: "top",
      offset: [0, -10],
      opacity: 0.95,
      permanent: true,
    });
    let activeDrawType: string | null = null;
    let polygonVertices: L.LatLng[] = [];
    let rectangleStart: L.LatLng | null = null;

    const formatDistance = (meters: number) => {
      if (!Number.isFinite(meters)) return "-";
      if (meters >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
      return `${Math.round(meters)} m`;
    };

    const hideDistanceTooltip = () => {
      if (map.hasLayer(distanceTooltip)) map.removeLayer(distanceTooltip);
      polygonVertices = [];
      rectangleStart = null;
      activeDrawType = null;
    };

    const showDistanceTooltip = (latlng: L.LatLng, content: string) => {
      distanceTooltip.setLatLng(latlng).setContent(content);
      if (!map.hasLayer(distanceTooltip)) distanceTooltip.addTo(map);
    };

    const handleDrawStart = (e: L.LeafletEvent) => {
      activeDrawType = (e as L.LeafletEvent & { layerType?: string }).layerType ?? null;
      polygonVertices = [];
      rectangleStart = null;
    };

    const handleDrawVertex = (e: L.LeafletEvent) => {
      const layers = (e as L.LeafletEvent & { layers?: L.LayerGroup }).layers;
      if (!layers || activeDrawType !== "polygon") return;
      polygonVertices = layers
        .getLayers()
        .map((layer) => (layer as L.Marker).getLatLng?.())
        .filter((latlng): latlng is L.LatLng => Boolean(latlng));
    };

    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      if (rectangleModeActive) {
        if (!rectangleStartPoint) {
          rectangleStartPoint = e.latlng;
          rectanglePreview = L.rectangle(rectangleBounds(e.latlng, e.latlng), rectanglePreviewStyle).addTo(map);
        } else {
          finishRectangle(e.latlng);
        }
        return;
      }

      if (activeDrawType === "rectangle") rectangleStart = e.latlng;
    };

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (rectangleModeActive && rectangleStartPoint) {
        const bounds = rectangleBounds(rectangleStartPoint, e.latlng);
        if (rectanglePreview) rectanglePreview.setBounds(bounds);
        const horizontal = L.latLng(rectangleStartPoint.lat, e.latlng.lng).distanceTo(rectangleStartPoint);
        const vertical = L.latLng(e.latlng.lat, rectangleStartPoint.lng).distanceTo(rectangleStartPoint);
        const diagonal = rectangleStartPoint.distanceTo(e.latlng);
        showDistanceTooltip(e.latlng, `${formatDistance(horizontal)} x ${formatDistance(vertical)} | diagonal ${formatDistance(diagonal)}`);
        return;
      }

      if (activeDrawType === "polygon" && polygonVertices.length > 0) {
        const last = polygonVertices[polygonVertices.length - 1];
        const segment = last.distanceTo(e.latlng);
        const total = polygonVertices.reduce((sum, point, index) => {
          if (index === 0) return sum;
          return sum + polygonVertices[index - 1].distanceTo(point);
        }, 0);
        showDistanceTooltip(e.latlng, `Segmen ${formatDistance(segment)} · Total ${formatDistance(total + segment)}`);
        return;
      }

      if (activeDrawType === "rectangle" && rectangleStart) {
        const horizontal = L.latLng(rectangleStart.lat, e.latlng.lng).distanceTo(rectangleStart);
        const vertical = L.latLng(e.latlng.lat, rectangleStart.lng).distanceTo(rectangleStart);
        const diagonal = rectangleStart.distanceTo(e.latlng);
        showDistanceTooltip(e.latlng, `${formatDistance(horizontal)} × ${formatDistance(vertical)} · diagonal ${formatDistance(diagonal)}`);
      }
    };

    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);
    map.on(L.Draw.Event.DELETED, handleDeleted);
    map.on("draw:drawstart", handleDrawStart);
    map.on("draw:drawvertex", handleDrawVertex);
    map.on("draw:drawstop", hideDistanceTooltip);
    map.on("draw:deletestart", hideDistanceTooltip);
    map.on("draw:editstart", hideDistanceTooltip);
    map.on("mousemove", handleMouseMove);
    map.on("mousedown", handleMouseDown);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.off(L.Draw.Event.DELETED, handleDeleted);
      map.off("draw:drawstart", handleDrawStart);
      map.off("draw:drawvertex", handleDrawVertex);
      map.off("draw:drawstop", hideDistanceTooltip);
      map.off("draw:deletestart", hideDistanceTooltip);
      map.off("draw:editstart", hideDistanceTooltip);
      map.off("mousemove", handleMouseMove);
      map.off("mousedown", handleMouseDown);
      drawnItems.off("layeradd layerremove", updateEditToolsVisibility);
      cancelRectangleMode();
      hideDistanceTooltip();
      map.getContainer().classList.remove("aoi-draw-empty");
      map.removeControl(rectangleControl);
      map.removeControl(curveControl);
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
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20], maxZoom: HIGH_DETAIL_MAX_ZOOM });
}

/**
 * Redraws a persisted/shared AOI (e.g. from `useAoiStore`) into this map's own
 * draw `FeatureGroup` on mount. `AoiDrawingTools` only ever populates that
 * group from an interactive draw/edit event or an explicit `setAoiOnMap`
 * call - a brand-new map instance (module remounted after a route change,
 * a second map showing the same AOI, etc.) starts with an empty group and
 * never gets the existing AOI drawn into it otherwise, even though the AOI
 * *state* itself is still there. Only syncs while the group is empty, so it
 * won't clobber a shape the user is actively drawing/editing in this map.
 */
export function SyncAoiToGroup({
  aoi,
  groupRef,
}: {
  aoi: AoiFeature | null;
  groupRef: RefObject<L.FeatureGroup | null>;
}) {
  const map = useMap();
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    if (!aoi) {
      group.clearLayers();
      return;
    }
    if (group.getLayers().length === 0) setAoiOnMap(map, group, aoi);
  }, [aoi, map, groupRef]);
  return null;
}
