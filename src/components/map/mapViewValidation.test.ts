import L from "leaflet";
import { describe, expect, it } from "vitest";
import {
  isFiniteMapBounds,
  isValidMapCenter,
  safeMapCenter,
  safeMapZoom,
  safeTileSize,
  safeZoomOffset,
} from "./mapViewValidation";

describe("Leaflet view input validation", () => {
  it("rejects non-finite and out-of-range centers", () => {
    expect(isValidMapCenter([-2.5, 118])).toBe(true);
    expect(isValidMapCenter([Number.NaN, 118])).toBe(false);
    expect(isValidMapCenter([0, Number.POSITIVE_INFINITY])).toBe(false);
    expect(isValidMapCenter([91, 0])).toBe(false);
    expect(safeMapCenter([Number.NaN, 118], [-2.5, 118])).toEqual([-2.5, 118]);
  });

  it("clamps invalid zoom values before they reach Leaflet", () => {
    expect(safeMapZoom(7, 22, 5)).toBe(7);
    expect(safeMapZoom(30, 22, 5)).toBe(22);
    expect(safeMapZoom(Number.NaN, 22, 5)).toBe(5);
    expect(safeMapZoom(Number.POSITIVE_INFINITY, 22, 5)).toBe(5);
    expect(safeMapZoom(7, Number.NaN, 5)).toBe(7);
  });

  it("replaces invalid tile sizing metadata before it reaches Leaflet", () => {
    expect(safeTileSize(512)).toBe(512);
    expect(safeTileSize(0)).toBe(256);
    expect(safeTileSize(Number.POSITIVE_INFINITY)).toBe(256);
    expect(safeZoomOffset(-1)).toBe(-1);
    expect(safeZoomOffset(Number.NaN)).toBe(0);
  });

  it("rejects non-finite geographic bounds even when Leaflet marks them valid", () => {
    const valid = L.latLngBounds([
      [-6, 95],
      [6, 109],
    ]);
    const invalid = L.latLngBounds([
      [-6, 95],
      [6, 109],
    ]);
    (invalid as unknown as { _southWest: { lng: number } })._southWest.lng = Number.NaN;

    expect(isFiniteMapBounds(valid)).toBe(true);
    expect(invalid.isValid()).toBe(true);
    expect(isFiniteMapBounds(invalid)).toBe(false);
  });
});
