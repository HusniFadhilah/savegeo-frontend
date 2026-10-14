import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IslandThumbnail from "./IslandThumbnail";
import { islandGeometryToSvgPath } from "./islandThumbnailGeometry";
import { fetchIslandGeometry } from "@/services/analysisService";

vi.mock("@/services/analysisService", () => ({
  fetchIslandGeometry: vi.fn(),
}));

const sumatraBoundary: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [100, -5],
            [102, -5],
            [102, 5],
            [100, 5],
            [100, -5],
          ],
        ],
      },
    },
  ],
};

describe("IslandThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("draws the configured island boundary for regional wildfire events", async () => {
    vi.mocked(fetchIslandGeometry).mockResolvedValue(sumatraBoundary);

    render(<IslandThumbnail slug="sumatra-2026" title="Karhutla Sumatra 2026" />);

    expect(
      await screen.findByRole("img", { name: "Karhutla Sumatra 2026, peta cakupan Sumatra" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        document.querySelector(".disaster-island-thumbnail svg path")?.getAttribute("d"),
      ).toMatch(/^M /),
    );
    expect(fetchIslandGeometry).toHaveBeenCalledWith("Sumatra");
    expect(screen.getByText("Sumatra")).toBeTruthy();
  });

  it("does not request or invent an island for an unknown event", () => {
    render(<IslandThumbnail slug="unknown-wildfire" title="Karhutla" />);

    expect(fetchIslandGeometry).not.toHaveBeenCalled();
    expect(screen.getByText("Wilayah kejadian")).toBeTruthy();
  });

  it("returns no silhouette when the provided geometry has no polygon coordinates", () => {
    expect(islandGeometryToSvgPath({ type: "Point", coordinates: [105, -2] })).toBe("");
  });
});
