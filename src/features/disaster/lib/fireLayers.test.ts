import { describe, expect, it } from "vitest";
import type { Feature, FeatureCollection } from "geojson";
import { administrativePointCounts, featureContainsPoint, visibleHotspots } from "./fireLayers";
import type { FireMultiSourceLayerState } from "../types";

const region: Feature = {
  type: "Feature",
  properties: { name: "Test" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ],
    ],
  },
};
const points: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { source_ids: ["bmkg", "firms_modis"] },
      geometry: { type: "Point", coordinates: [1, 1] },
    },
    {
      type: "Feature",
      properties: { source_ids: ["firms_modis"] },
      geometry: { type: "Point", coordinates: [5, 5] },
    },
  ],
};

describe("wildfire source layers", () => {
  it("respects polygon holes", () => {
    expect(featureContainsPoint(region, [1, 1])).toBe(true);
    expect(featureContainsPoint(region, [5, 5])).toBe(false);
    expect(featureContainsPoint(region, [20, 20])).toBe(false);
  });
  it("counts spatial observations, not events", () => {
    expect(
      administrativePointCounts({ type: "FeatureCollection", features: [region] }, points),
    ).toEqual([{ name: "Test", count: 1 }]);
  });
  it("filters merged groups by visible source", () => {
    const state: FireMultiSourceLayerState = {
      result: {
        sources: [],
        hotspots: points,
        raw_count: 3,
        merged_count: 2,
        generated_at: "",
        period: { start: "", end: "" },
        note: "",
      },
      visibleSources: ["bmkg"],
      showMerged: true,
      imported: null,
      showImport: false,
    };
    expect(visibleHotspots(state).features).toHaveLength(1);
    expect(visibleHotspots({ ...state, visibleSources: [] }).features).toHaveLength(0);
  });
});
