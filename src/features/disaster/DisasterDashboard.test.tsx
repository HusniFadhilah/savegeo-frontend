import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import DisasterDashboard from "./DisasterDashboard";
import {
  fetchDisasterEvent,
  fetchDisasterHotspots,
  fetchDisasterLayers,
  fetchDisasterStatistics,
} from "./api";
import type { DisasterEventDetailResponse } from "./types";

vi.mock("./api", () => ({
  analyzeDemSlope: vi.fn(),
  fetchBmkgAlerts: vi.fn(),
  fetchDisasterEvent: vi.fn(),
  fetchDisasterHotspots: vi.fn(),
  fetchDisasterLayers: vi.fn(),
  fetchDisasterSources: vi.fn(),
  fetchDisasterStatistics: vi.fn(),
}));

vi.mock("@/hooks/useI18nStore", () => ({
  useI18nStore: () => ({ t: (key: string) => key }),
}));

vi.mock("./components/SegmentationComparison", () => ({ default: () => null }));
vi.mock("./components/SatelliteViewer", () => ({ default: () => null }));
vi.mock("./components/LayerPanel", () => ({ default: () => null }));
vi.mock("./components/KpiTiles", () => ({ default: () => null }));
vi.mock("./components/StatisticsPanel", () => ({ default: () => null }));
vi.mock("./components/HotspotPanel", () => ({ default: () => null }));
vi.mock("./components/SourceStatusPanel", () => ({ default: () => null }));
vi.mock("./components/BmkgAlerts", () => ({ default: () => null }));
vi.mock("./components/DemSlopeControls", () => ({ default: () => null }));
vi.mock("./components/FirmsHotspotPanel", () => ({ default: () => null }));
vi.mock("./components/SamGeoSegmentationPanel", () => ({ default: () => null }));

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/pemetaan-bencana/40"]}>
      <Routes>
        <Route path="/pemetaan-bencana/:eventId" element={<DisasterDashboard />} />
        <Route path="/pemetaan-bencana/karhutla/:slug" element={<KarhutlaTarget />} />
      </Routes>
    </MemoryRouter>,
  );
}

function KarhutlaTarget() {
  const location = useLocation();
  return <div data-testid="karhutla-target">{location.pathname}</div>;
}

describe("DisasterDashboard event subresources", () => {
  afterEach(() => vi.clearAllMocks());

  it("does not request layers, statistics, or hotspots when the event detail is unavailable", async () => {
    vi.mocked(fetchDisasterEvent).mockRejectedValue(new Error("not found"));

    const { findByText } = renderDashboard();

    await findByText("disaster.detail.loadFailed");

    expect(fetchDisasterEvent).toHaveBeenCalledOnce();
    expect(fetchDisasterLayers).not.toHaveBeenCalled();
    expect(fetchDisasterStatistics).not.toHaveBeenCalled();
    expect(fetchDisasterHotspots).not.toHaveBeenCalled();
  });

  it("loads event subresources after the detail confirms a published event", async () => {
    let resolveDetail!: (value: DisasterEventDetailResponse) => void;
    vi.mocked(fetchDisasterEvent).mockReturnValue(
      new Promise<DisasterEventDetailResponse>((resolve) => { resolveDetail = resolve; }),
    );
    vi.mocked(fetchDisasterLayers).mockResolvedValue({
      satellite: { pre_tile_url: null, post_tile_url: null },
      analyses: [],
    });
    vi.mocked(fetchDisasterStatistics).mockResolvedValue({ kpis: {}, cross_layer: [] });
    vi.mocked(fetchDisasterHotspots).mockResolvedValue({ hotspots: [] });

    renderDashboard();
    expect(fetchDisasterLayers).not.toHaveBeenCalled();
    expect(fetchDisasterStatistics).not.toHaveBeenCalled();
    expect(fetchDisasterHotspots).not.toHaveBeenCalled();

    await act(async () => {
      resolveDetail({
        event: {
          id: 40,
          disaster_type: "flood",
          severity: null,
          event_date: null,
          name: "Uji kejadian",
          location_name: null,
          province: [],
          district: [],
          description: null,
          start_date: null,
          end_date: null,
          status: "published",
          source: null,
          thumbnail: null,
          created_at: null,
          updated_at: null,
        },
        aoi: null,
        imagery: { pre: [], post: [] },
        primary_imagery: { pre: null, post: null },
      });
    });

    await waitFor(() => {
      expect(fetchDisasterLayers).toHaveBeenCalledWith(40);
      expect(fetchDisasterStatistics).toHaveBeenCalledWith(40);
      expect(fetchDisasterHotspots).toHaveBeenCalledWith(40);
    });
  });

  it("opens the dedicated Karhutla detail page for a forest-fire event id", async () => {
    vi.mocked(fetchDisasterEvent).mockResolvedValue({
      event: {
        id: 40,
        name: "Karhutla Kalimantan 2026",
        disaster_type: "forest_fire",
        slug: "kalimantan-2026",
        location_name: null,
        province: [],
        district: [],
        event_date: null,
        start_date: null,
        end_date: null,
        status: "published",
        severity: null,
        description: null,
        source: null,
        thumbnail: null,
        created_at: null,
        updated_at: null,
      },
      aoi: null,
      imagery: { pre: [], post: [] },
      primary_imagery: { pre: null, post: null },
    });

    const { findByTestId } = renderDashboard();

    expect((await findByTestId("karhutla-target")).textContent).toBe(
      "/pemetaan-bencana/karhutla/kalimantan-2026",
    );
    expect(fetchDisasterEvent).toHaveBeenCalledWith("40");
    expect(fetchDisasterLayers).not.toHaveBeenCalled();
    expect(fetchDisasterStatistics).not.toHaveBeenCalled();
    expect(fetchDisasterHotspots).not.toHaveBeenCalled();
  });
});
