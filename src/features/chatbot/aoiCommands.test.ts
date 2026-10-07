import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/apiClient";
import { useAoiStore } from "@/hooks/useAoiStore";
import {
  AoiChoiceRequired,
  resolveAoi,
  selectAoi,
  validateAoiGeometry,
  type AoiCandidate,
} from "./aoiCommands";
import { getActiveMap, highlightPolygon } from "./mapActions";
import { executeUiCommand, registerUiCommands } from "./uiCommandBus";
import { runActions, type ActionRunContext } from "./actionExecutor";

vi.mock("@/services/apiClient", () => ({ apiClient: { get: vi.fn() } }));
vi.mock("./mapActions", () => ({
  getActiveMap: vi.fn(),
  highlightPolygon: vi.fn(),
  zoomToFeature: vi.fn(),
  zoomToLocation: vi.fn(),
}));
const candidate: AoiCandidate = {
  osm_id: 1,
  display_name: "Kota Semarang, Jawa Tengah",
  geojson: {
    type: "Polygon",
    coordinates: [
      [
        [110, -7],
        [111, -7],
        [111, -6],
        [110, -6],
        [110, -7],
      ],
    ],
  },
};
const fitBounds = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  useAoiStore.getState().setAoi(null);
  vi.mocked(getActiveMap).mockReturnValue({ fitBounds } as unknown as ReturnType<
    typeof getActiveMap
  >);
});

describe("AOI application commands", () => {
  it("resolves actual geometry, changes shared state, fits the viewport and highlights", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ results: [candidate] });
    await executeUiCommand({
      action: "select_aoi",
      target: "aoi.active",
      parameters: { query: "Kota Semarang" },
    });
    expect(useAoiStore.getState().aoi?.name).toBe(candidate.display_name);
    expect(useAoiStore.getState().aoi?.feature.geometry).toEqual(candidate.geojson);
    expect(fitBounds).toHaveBeenCalledOnce();
    expect(highlightPolygon).toHaveBeenCalled();
  });
  it("preserves state and presents ambiguity", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      results: [candidate, { ...candidate, osm_id: 2, display_name: "Kabupaten Semarang" }],
    });
    await expect(resolveAoi("Semarang")).rejects.toBeInstanceOf(AoiChoiceRequired);
    expect(useAoiStore.getState().aoi).toBeNull();
    expect(fitBounds).not.toHaveBeenCalled();
  });
  it("does not turn missing polygons into fabricated bbox AOIs", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ results: [{ ...candidate, geojson: null }] });
    await expect(resolveAoi("Semarang")).rejects.toThrow(/tidak ditemukan/);
    expect(useAoiStore.getState().aoi).toBeNull();
  });
  it("validates rings and coordinates on client", () => {
    expect(validateAoiGeometry(candidate.geojson)).toBe(true);
    expect(
      validateAoiGeometry({
        type: "Polygon",
        coordinates: [
          [
            [1800, -7],
            [0, 0],
            [1, 1],
            [1800, -7],
          ],
        ],
      }),
    ).toBe(false);
    expect(
      validateAoiGeometry({
        type: "Polygon",
        coordinates: [
          [
            [110, -7],
            [111, -7],
            [111, -6],
            [110, -6],
          ],
        ],
      }),
    ).toBe(false);
  });
  it("does not claim navigation when no map exists", () => {
    vi.mocked(getActiveMap).mockReturnValue(null);
    expect(() => selectAoi(candidate)).toThrow(/Peta belum tersedia/);
    expect(useAoiStore.getState().aoi).toBeNull();
  });
  it("passes resolved AOI into the owning analysis API and verifies displayed result", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ results: [candidate] });
    let result = false;
    const backend = vi.fn(async (geometry: unknown) => {
      expect(geometry).toEqual(candidate.geojson);
      return { tile_url: "/real-result/{z}/{x}/{y}", statistics: { total: 12 } };
    });
    const dispose = registerUiCommands("carbon", {
      read: () => ({ hasResult: result }),
      execute: async () => {
        const data = await backend(useAoiStore.getState().aoi?.feature.geometry);
        result = Boolean(data.tile_url);
      },
    });
    const ctx: ActionRunContext = {
      addAssistantMessage: vi.fn(),
      addGuideStep: vi.fn(),
      addChoiceCard: vi.fn(),
      offerBoundaryDownload: vi.fn(),
      setFileInputAccept: vi.fn(),
    };
    try {
      await runActions(
        [
          { action: "select_aoi", target: "aoi.active", parameters: { query: "Kota Semarang" } },
          { action: "run_analysis", target: "carbon.analysis" },
        ],
        ctx,
      );
      expect(backend).toHaveBeenCalledOnce();
      expect(result).toBe(true);
      expect(fitBounds).toHaveBeenCalledOnce();
    } finally {
      dispose();
    }
  });
  it("stops downstream execution on missing AOI", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ results: [] });
    const execute = vi.fn();
    const dispose = registerUiCommands("carbon", { read: () => ({ hasResult: true }), execute });
    const ctx: ActionRunContext = {
      addAssistantMessage: vi.fn(),
      addGuideStep: vi.fn(),
      addChoiceCard: vi.fn(),
      offerBoundaryDownload: vi.fn(),
      setFileInputAccept: vi.fn(),
    };
    try {
      await expect(
        runActions(
          [
            { action: "select_aoi", target: "aoi.active", parameters: { query: "unknown" } },
            { action: "run_analysis", target: "carbon.analysis" },
          ],
          ctx,
        ),
      ).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });
});
