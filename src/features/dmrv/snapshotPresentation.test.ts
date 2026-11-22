import { describe, expect, it } from "vitest";
import { snapshotAoi, snapshotLayers, snapshotMetrics } from "./snapshotPresentation";
import type { DmrvSnapshot } from "./types";
const snapshot = (outputs: Record<string, unknown>, kind = "carbon"): DmrvSnapshot => ({
  id: "s1",
  project_id: "p1",
  job_id: "j1",
  kind,
  inputs: {},
  outputs,
  snapshot_hash: "hash",
  created_by: "user:1",
  created_at: null,
});
describe("snapshot presentation", () => {
  it("keeps zero statistics, excludes missing values and does not invent totals", () => {
    expect(
      snapshotMetrics(
        snapshot({
          carbon_estimated: {
            statistics: { mean: 0, min: null, max: 12, std_dev: NaN },
            unit: "Mg C/ha",
          },
          area_info: {},
        }),
      ),
    ).toEqual([
      { key: "mean", value: 0, unit: "Mg C/ha" },
      { key: "max", value: 12, unit: "Mg C/ha" },
    ]);
  });
  it("collects safe nested raster URLs without duplicating the same layer", () => {
    const layers = snapshotLayers({
      carbon_estimated: {
        tile_url: "https://earthengine.googleapis.com/tiles/{z}/{x}/{y}",
        unit: "Mg C/ha",
        vis_params: { min: 0, max: 100, palette: ["000000", "#ffffff", "url(evil)"] },
      },
      carbon_reference: { tile_url: "https://earthengine.googleapis.com/tiles/{z}/{x}/{y}" },
      invalid: { tile_url: "javascript:alert(1)", changed_tile_url: "//other.test/tiles" },
      credentials: { tile_url: "https://secret:password@other.test/tiles" },
      landcover: {
        tile_url: "/api/tiles/{z}/{x}/{y}",
        native_scale: 10,
        classes: { Tree: { color: "00aa00", percentage: 60 }, Bad: { color: "invalid" } },
      },
    });
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({
      key: "carbon_estimated",
      min: 0,
      max: 100,
      colors: ["#000000", "#ffffff"],
    });
    expect(layers[1]).toMatchObject({
      resolution: 10,
      entries: [{ label: "Tree", color: "#00aa00", value: "60%" }],
    });
  });
  it("extracts the pinned AOI from both raw and Feature geometries", () => {
    const geometry = {
      type: "Polygon",
      coordinates: [
        [
          [110, -7],
          [111, -7],
          [111, -6],
          [110, -7],
        ],
      ],
    };
    const row = snapshot({});
    expect(snapshotAoi(row)).toBeNull();
    row.inputs = { context: { parameters: { aoi: { geojson: geometry } } } };
    expect(snapshotAoi(row)?.geometry).toEqual(geometry);
    row.inputs = { context: { parameters: { aoi: { geojson: { type: "Feature", geometry } } } } };
    expect(snapshotAoi(row)?.geometry).toEqual(geometry);
  });
  it("presents independent vegetation indices without substituting another index", () => {
    expect(
      snapshotMetrics(
        snapshot({ indices: { NDVI: { mean: 0.7, min: null }, EVI: { max: 0.4 } } }, "vegetation"),
      ),
    ).toEqual([
      { key: "NDVI / mean", value: 0.7, unit: "" },
      { key: "EVI / max", value: 0.4, unit: "" },
    ]);
  });
});
