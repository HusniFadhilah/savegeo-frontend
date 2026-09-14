import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeatureCollection } from "geojson";
import FireMultiSourcePanel from "./FireMultiSourcePanel";
import { loadFireMultiSource } from "../api";

vi.mock("../api", () => ({ loadFireMultiSource: vi.fn(), importFireObservations: vi.fn() }));
const aoi: FeatureCollection = { type: "FeatureCollection", features: [] };
const props = {
  aoi,
  boundaries: null,
  region: "Kalimantan Selatan",
  startDate: "2026-08-01",
  endDate: "2026-08-31",
  onChange: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("multi-source wildfire controls", () => {
  it("requires an AOI before loading", () => {
    render(<FireMultiSourcePanel {...props} aoi={null} />);
    expect(
      (screen.getByRole("button", { name: /Muat semua sumber/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getAllByRole("checkbox")).toHaveLength(9);
  });
  it("renders source-specific failures alongside successful layers", async () => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() }),
    );
    vi.mocked(loadFireMultiSource).mockResolvedValue({
      sources: [
        { id: "firms_noaa20", status: "needs_key", message: "Key diperlukan", features: [] },
        { id: "cdse", status: "ok", kind: "footprints", message: "Footprint scene", features: [] },
      ],
      hotspots: { type: "FeatureCollection", features: [] },
      raw_count: 0,
      merged_count: 0,
      generated_at: "2026-09-13T00:00:00Z",
      period: { start: "2026-08-01", end: "2026-08-31" },
      note: "Bukan jumlah kejadian",
    });
    render(<FireMultiSourcePanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Muat semua sumber/ }));
    await waitFor(() => expect(screen.getByText(/Perlu API key/)).toBeTruthy());
    expect(screen.getByText(/Tersedia/)).toBeTruthy();
    expect(vi.mocked(loadFireMultiSource).mock.calls[0][0].sources).toHaveLength(9);
    expect(props.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ result: expect.objectContaining({ raw_count: 0 }) }),
    );
  });
});
