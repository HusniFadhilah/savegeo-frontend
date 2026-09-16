import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import FirmsHotspotPanel from "./FirmsHotspotPanel";
import { fetchFirmsFires, fetchFirmsSources } from "../api";

vi.mock("../api", () => ({ fetchFirmsFires: vi.fn(), fetchFirmsSources: vi.fn() }));

const aoi = {
  id: 1,
  event_id: 2,
  area_ha: 10,
  centroid: null,
  bbox: [106, -7, 107, -6] as [number, number, number, number],
  source: "test",
  created_at: null,
  geojson: {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [[[106, -7], [107, -7], [107, -6], [106, -6], [106, -7]]] },
  },
};

describe("FIRMS hotspot panel", () => {
  it("does not request fire data until the toggle is enabled", async () => {
    vi.mocked(fetchFirmsSources).mockResolvedValue({ configured: true, sources: [], wms_layers: [], cache_ttl_seconds: 900, attribution: "NASA FIRMS" });
    vi.mocked(fetchFirmsFires).mockResolvedValue({
      type: "FeatureCollection",
      features: [],
      metadata: { source: "all", fetched_at: "2026-09-15T00:00:00Z", count: 0, raw_count: 0, is_near_real_time: true, cached: false, stale: false, truncated: false, errors: [], summary: { total_hotspots: 0, high_confidence_hotspots: 0, total_frp: 0, max_frp: 0, latest_detection_utc: null, by_day: [], by_source: [] }, attribution: "NASA FIRMS", disclaimer: "Hotspot" },
    });
    render(<MemoryRouter><FirmsHotspotPanel aoi={aoi} onChange={vi.fn()} onZoom={vi.fn()} /></MemoryRouter>);
    expect(fetchFirmsFires).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: /FIRMS hotspots|hotspot FIRMS/i }));
    await waitFor(() => expect(fetchFirmsFires).toHaveBeenCalled(), { timeout: 2000 });
    expect(vi.mocked(fetchFirmsFires).mock.calls[0][0]).toEqual(expect.objectContaining({ source: "all", day_range: 1, west: 106, south: -7, east: 107, north: -6 }));
  });
});
