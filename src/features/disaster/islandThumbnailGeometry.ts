type Point = GeoJSON.Position;

const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 168;
const VIEW_PADDING = 22;

function geometryRings(geometry: GeoJSON.GeoJSON): Point[][] {
  switch (geometry.type) {
    case "FeatureCollection":
      return geometry.features.flatMap((feature) =>
        feature.geometry ? geometryRings(feature.geometry) : [],
      );
    case "Feature":
      return geometry.geometry ? geometryRings(geometry.geometry) : [];
    case "Polygon":
      return geometry.coordinates;
    case "MultiPolygon":
      return geometry.coordinates.flat();
    case "GeometryCollection":
      return geometry.geometries.flatMap(geometryRings);
    default:
      return [];
  }
}

/** Build an island silhouette from the backend's authoritative island boundary. */
export function islandGeometryToSvgPath(geometry: GeoJSON.GeoJSON): string {
  const rings = geometryRings(geometry).filter((ring) => ring.length >= 4);
  const points = rings
    .flatMap((ring) => ring)
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!points.length) return "";

  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const midLatitude = (south + north) / 2;
  const longitudeScale = Math.cos((midLatitude * Math.PI) / 180);
  const spanX = Math.max((east - west) * longitudeScale, 0.001);
  const spanY = Math.max(north - south, 0.001);
  const scale = Math.min(
    (VIEW_WIDTH - VIEW_PADDING * 2) / spanX,
    (VIEW_HEIGHT - VIEW_PADDING * 2) / spanY,
  );
  const centerX = (west + east) / 2;
  const centerY = (south + north) / 2;

  return rings
    .map((ring) => {
      const valid = ring.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
      if (valid.length < 4) return "";
      const [first, ...rest] = valid;
      const x = (point: Point) => VIEW_WIDTH / 2 + (point[0] - centerX) * longitudeScale * scale;
      const y = (point: Point) => VIEW_HEIGHT / 2 - (point[1] - centerY) * scale;
      return `M ${x(first).toFixed(2)} ${y(first).toFixed(2)} ${rest.map((point) => `L ${x(point).toFixed(2)} ${y(point).toFixed(2)}`).join(" ")} Z`;
    })
    .filter(Boolean)
    .join(" ");
}
