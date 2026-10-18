import { beforeEach, describe, expect, it, vi } from "vitest";
import L from "leaflet";
import { apiClient } from "@/services/apiClient";
import { useAoiStore } from "@/hooks/useAoiStore";
import {
  AoiChoiceRequired,
  AoiRequestSuperseded,
  confirmActiveAoi,
  normalizeCandidate,
  resolveAoi,
  selectAoi,
  validateAoiGeometry,
  type AoiCandidate,
} from "./aoiCommands";
import { fitBoundsSafe, getActiveMap, highlightPolygon, waitForActiveMap } from "./mapActions";
import { executeUiCommand, registerUiCommands } from "./uiCommandBus";
import { runActions, type ActionRunContext } from "./actionExecutor";

vi.mock("@/services/apiClient", () => ({ apiClient: { get: vi.fn() } }));
vi.mock("./navigation", () => ({ openDashboardModule: vi.fn(), isAssistantModule: () => true }));
vi.mock("./mapActions", () => ({
  getActiveMap: vi.fn(),
  waitForActiveMap: vi.fn(),
  fitBoundsSafe: vi.fn(() => true),
  highlightPolygon: vi.fn(() => true),
  setMapView: vi.fn(),
}));

const square = (lon: number): GeoJSON.Polygon => ({
  type: "Polygon",
  coordinates: [
    [
      [lon, -7],
      [lon + 1, -7],
      [lon + 1, -6],
      [lon, -6],
      [lon, -7],
    ],
  ],
});

function raw(name: string, id: number, level: string, extra: Record<string, unknown> = {}) {
  return {
    area_id: `osm:relation:${id}`,
    name,
    display_name: `${name}, Jawa Tengah, Indonesia`,
    level,
    hierarchy: {},
    centroid: { lat: -6.5, lng: 110.5 },
    bbox: [110, -7, 111, -6],
    geometry: square(110 + id),
    source: "nominatim/openstreetmap",
    exact_match: false,
    ...extra,
  };
}

const kota = raw("Kota Semarang", 1, "city");
const kabupaten = raw("Kabupaten Semarang", 2, "regency");
const fakeMap = {} as L.Map;

function ctx(): ActionRunContext {
  return {
    addAssistantMessage: vi.fn(),
    addGuideStep: vi.fn(),
    addChoiceCard: vi.fn(),
    setFileInputAccept: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAoiStore.getState().setAoi(null);
  vi.mocked(getActiveMap).mockReturnValue(fakeMap);
  vi.mocked(waitForActiveMap).mockResolvedValue(fakeMap);
  vi.mocked(fitBoundsSafe).mockReturnValue(true);
});

describe("Pilih Kota Semarang", () => {
  it("selects Kota Semarang, not Kabupaten Semarang, and fits + highlights it", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      results: [{ ...kota, exact_match: true }, kabupaten],
    });
    const state = await executeUiCommand({
      action: "select_aoi",
      target: "aoi.active",
      parameters: { query: "Kota Semarang" },
      expected_state: { aoiExists: true },
    });
    expect(useAoiStore.getState().aoi?.name).toContain("Kota Semarang");
    expect(useAoiStore.getState().aoi?.feature.properties.area_id).toBe("osm:relation:1");
    expect(state.level).toBe("city");
    expect(fitBoundsSafe).toHaveBeenCalledOnce();
    expect(highlightPolygon).toHaveBeenCalledOnce();
  });

  it("asks the user to choose when the query is ambiguous and leaves the AOI untouched", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ results: [kota, kabupaten] });
    await expect(resolveAoi("Semarang")).rejects.toBeInstanceOf(AoiChoiceRequired);
    expect(useAoiStore.getState().aoi).toBeNull();
    expect(fitBoundsSafe).not.toHaveBeenCalled();
  });

  it("switching to Kabupaten Semarang replaces state and highlight cleanly", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ results: [{ ...kota, exact_match: true }] })
      .mockResolvedValueOnce({ results: [{ ...kabupaten, exact_match: true }] });
    await resolveAoi("Kota Semarang");
    await resolveAoi("Kabupaten Semarang");
    expect(useAoiStore.getState().aoi?.name).toContain("Kabupaten Semarang");
    expect(highlightPolygon).toHaveBeenCalledTimes(2);
  });

  it("does not turn candidates without a polygon into fabricated AOIs", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ results: [{ ...kota, geometry: null }] });
    await expect(resolveAoi("Kota Semarang")).rejects.toThrow(/tidak ditemukan/);
    expect(useAoiStore.getState().aoi).toBeNull();
  });
});

describe("request ordering", () => {
  it("a newer AOI request cancels the older one and the old result never lands", async () => {
    let firstSignal: AbortSignal | null | undefined;
    vi.mocked(apiClient.get)
      .mockImplementationOnce(
        (_path: string, options?: { signal?: AbortSignal | null }) =>
          new Promise((_resolve, reject) => {
            firstSignal = options?.signal;
            options?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      )
      .mockResolvedValueOnce({ results: [{ ...kabupaten, exact_match: true }] });

    const first = resolveAoi("Kota Semarang");
    const firstOutcome = first.catch((e) => e);
    await Promise.resolve();
    await resolveAoi("Kabupaten Semarang");

    expect(firstSignal?.aborted).toBe(true);
    expect(await firstOutcome).toBeInstanceOf(AoiRequestSuperseded);
    expect(useAoiStore.getState().aoi?.name).toContain("Kabupaten Semarang");
  });

  it("a selection superseded while waiting for the map does not commit", async () => {
    let release: (map: L.Map) => void = () => {};
    vi.mocked(getActiveMap).mockReturnValue(null);
    vi.mocked(waitForActiveMap).mockImplementation(
      () => new Promise<L.Map>((resolve) => (release = resolve)),
    );
    const slow = selectAoi(normalizeCandidate(kota) as AoiCandidate, { settleMs: 1, mountMs: 1 });
    const slowOutcome = slow.catch((e) => e);
    vi.mocked(getActiveMap).mockReturnValue(fakeMap);
    await selectAoi(normalizeCandidate(kabupaten) as AoiCandidate);
    release(fakeMap);
    expect(await slowOutcome).toBeInstanceOf(AoiRequestSuperseded);
    expect(useAoiStore.getState().aoi?.name).toContain("Kabupaten Semarang");
  });
});

describe("geometry and map safety", () => {
  it("rejects invalid geometry without replacing the active AOI", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ results: [{ ...kota, exact_match: true }] });
    await resolveAoi("Kota Semarang");
    const before = useAoiStore.getState().aoi;
    const bad = normalizeCandidate({ ...kota, area_id: "bad", geometry: { type: "Polygon", coordinates: [] } });
    await expect(selectAoi(bad as AoiCandidate)).rejects.toThrow(/tidak valid/);
    expect(useAoiStore.getState().aoi).toBe(before);
  });

  it("validates rings, ranges, finiteness, extent and size", () => {
    expect(validateAoiGeometry(square(110))).toBe(true);
    const open = { type: "Polygon", coordinates: [[[110, -7], [111, -7], [111, -6], [110, -6]]] };
    const outOfRange = { type: "Polygon", coordinates: [[[1800, -7], [0, 0], [1, 1], [1800, -7]]] };
    const nan = { type: "Polygon", coordinates: [[[NaN, -7], [111, -7], [111, -6], [NaN, -7]]] };
    const flat = { type: "Polygon", coordinates: [[[110, -7], [111, -7], [112, -7], [110, -7]]] };
    const ring = Array.from({ length: 30_001 }, (_, i) => [110 + (i % 100) * 1e-4, -7 + (i % 7) * 1e-4]);
    ring.push(ring[0]);
    const huge = { type: "Polygon", coordinates: [ring] };
    for (const g of [open, outOfRange, nan, flat, huge, null, { type: "Point", coordinates: [1, 1] }]) {
      expect(validateAoiGeometry(g)).toBe(false);
    }
  });

  it("opens the map module and waits when no map is on screen", async () => {
    const { openDashboardModule } = await import("./navigation");
    vi.mocked(getActiveMap).mockReturnValue(null);
    vi.mocked(waitForActiveMap).mockResolvedValueOnce(null).mockResolvedValueOnce(fakeMap);
    await selectAoi(normalizeCandidate(kota) as AoiCandidate);
    expect(openDashboardModule).toHaveBeenCalledWith("carbon");
    expect(useAoiStore.getState().aoi).not.toBeNull();
  });

  it("fails with an actionable error and keeps the old AOI when no map ever appears", async () => {
    vi.mocked(getActiveMap).mockReturnValue(null);
    vi.mocked(waitForActiveMap).mockResolvedValue(null);
    await expect(selectAoi(normalizeCandidate(kota) as AoiCandidate)).rejects.toThrow(/Peta belum tersedia/);
    expect(useAoiStore.getState().aoi).toBeNull();
  });
});

describe("Gunakan AOI yang sedang aktif", () => {
  it("re-focuses the active AOI", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ results: [{ ...kota, exact_match: true }] });
    await resolveAoi("Kota Semarang");
    vi.clearAllMocks();
    vi.mocked(getActiveMap).mockReturnValue(fakeMap);
    vi.mocked(waitForActiveMap).mockResolvedValue(fakeMap);
    const state = await executeUiCommand({ action: "use_active_aoi", target: "aoi.active" });
    expect(state.activeAoi).toBe(true);
    expect(fitBoundsSafe).toHaveBeenCalledOnce();
  });

  it("fails clearly when there is no active AOI", async () => {
    await expect(confirmActiveAoi()).rejects.toThrow(/Belum ada AOI aktif/);
  });
});

describe("queue behaviour", () => {
  it("passes the resolved AOI to the owning module and runs each action exactly once", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ results: [{ ...kota, exact_match: true }] });
    let runs = 0;
    const dispose = registerUiCommands("carbon", {
      read: () => ({ hasResult: runs > 0 }),
      execute: async () => {
        runs += 1;
        expect(useAoiStore.getState().aoi?.feature.geometry).toEqual(kota.geometry);
        return { hasResult: true, error: null };
      },
    });
    try {
      await runActions(
        [
          { action: "select_aoi", target: "aoi.active", parameters: { query: "Kota Semarang" } },
          { action: "run_analysis", target: "carbon.analysis" },
        ],
        ctx(),
      );
      expect(runs).toBe(1);
    } finally {
      dispose();
    }
  });

  it("stops downstream execution when the AOI cannot be resolved", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ results: [] });
    const execute = vi.fn();
    const dispose = registerUiCommands("carbon", { read: () => ({ hasResult: true }), execute });
    try {
      await expect(
        runActions(
          [
            { action: "select_aoi", target: "aoi.active", parameters: { query: "unknown" } },
            { action: "run_analysis", target: "carbon.analysis" },
          ],
          ctx(),
        ),
      ).rejects.toThrow();
      expect(execute).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it("rejects unknown legacy action types instead of ignoring or guessing", async () => {
    const c = ctx();
    await expect(runActions([{ type: "set_value", target: "year", value: 2024 }], c)).rejects.toThrow(
      /tidak didukung/,
    );
    await expect(
      runActions([{ action: "eval_js", target: "window.alert" }], c),
    ).rejects.toThrow();
  });
});
