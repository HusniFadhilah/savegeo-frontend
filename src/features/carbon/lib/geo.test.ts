import { describe, expect, it } from "vitest";
import { areaKm2, calculateAreaFromGeoJSON } from "./geo";
const ring = [[0,0],[1,0],[1,1],[0,1]];
const polygon = (coordinates: number[][][]) => ({ type: "Polygon", coordinates });
// Independent analytic area of a meridian/parallel strip on the documented sphere.
const reference = 6378137 ** 2 * Math.PI / 180 * Math.sin(Math.PI / 180) / 1e6;
describe("spherical area in square kilometres", () => {
  it("agrees with an analytic strip and counts a closed ring only once", () => {
    expect(calculateAreaFromGeoJSON(polygon([ring]))).toBeCloseTo(reference, 6);
    expect(calculateAreaFromGeoJSON(polygon([[...ring, ring[0]]]))).toBeCloseTo(reference, 6);
    expect(calculateAreaFromGeoJSON(polygon([[...ring].reverse()]))).toBeCloseTo(reference, 6);
  });
  it("subtracts holes and sums multipart geometries", () => {
    const hole = [[0,0],[0.5,0],[0.5,1],[0,1],[0,0]];
    expect(calculateAreaFromGeoJSON(polygon([ring, hole]))).toBeCloseTo(reference / 2, 6);
    expect(calculateAreaFromGeoJSON({ type: "MultiPolygon", coordinates: [[ring], [ring]] })).toBeCloseTo(2 * reference, 6);
  });
  it("uses the short crossing at the date line", () => {
    const crossing = [[179,0],[-179,0],[-179,1],[179,1],[179,0]];
    expect(calculateAreaFromGeoJSON(polygon([crossing]))).toBeCloseTo(reference * 2, 6);
  });
  it("does not turn invalid coordinates into a valid area", () => {
    expect(areaKm2(polygon([[[NaN,0],[1,0],[1,1],[0,1]]]))).toBeNull();
    expect(areaKm2(polygon([[[0,91],[1,0],[1,1],[0,1]]]))).toBeNull();
  });
});
