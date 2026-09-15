import { describe, expect, it } from "vitest";
import { selectEsriWaybackScene, type WaybackScene } from "./wayback";

function scene(date: string): WaybackScene {
  return {
    id: `wayback:${date}`,
    acquired_at: `${date}T00:00:00Z`,
    cloud_cover_pct: null,
    tile_url: `https://example.test/${date}/{z}/{x}/{y}.jpg`,
    release_label: date,
  };
}

describe("Esri Wayback scene selection", () => {
  const scenes = [scene("2024-01-15"), scene("2024-06-20"), scene("2025-02-10")];

  it("selects the latest published snapshot on or before the analysis date", () => {
    expect(selectEsriWaybackScene(scenes, "2024-12-31")?.release_label).toBe("2024-06-20");
  });

  it("falls back to the earliest archive snapshot when the date predates the archive", () => {
    expect(selectEsriWaybackScene(scenes, "2018-12-31")?.release_label).toBe("2024-01-15");
  });
});
