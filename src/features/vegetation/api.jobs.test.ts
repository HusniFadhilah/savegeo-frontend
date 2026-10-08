import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { analyzeVegetation } from "./api";
import { apiClient, ApiError } from "@/services/apiClient";
import { useAnalysisJobStore } from "@/services/analysisJobStore";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...actual, apiClient: { post: vi.fn(), get: vi.fn() } };
});

const aoi = { west: 114, south: -9, east: 116, north: -8 };
const params = { startMonth: 6, endMonth: 9, cloudThreshold: 10,
  indices: ["NDVI", "NDWI", "MNDWI", "NDBI"], satellite: "sentinel2",
  cloudMaskTechnique: "scl" as const };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.clearAllMocks();
  useAnalysisJobStore.setState({ jobs: [] });
  vi.mocked(apiClient.post).mockResolvedValue({ job_id: "bali-job", status: "queued", status_url: "/analysis-jobs/bali-job" });
});
afterEach(() => { vi.useRealTimers(); });

it("keeps polling vegetation beyond the old limit and accepts the observed 14-minute completion", async () => {
  const result = { collection_size: 114, indices: { NDVI: { mean: 0.672 } } };
  vi.mocked(apiClient.get).mockImplementation(async () => Date.now() >= 849_000
    ? { job_id: "bali-job", status: "succeeded", result }
    : { job_id: "bali-job", status: "running" });
  let settled = false;
  const outcome = analyzeVegetation(aoi, 2026, params).then(
    (value) => { settled = true; return { value }; },
    (error: unknown) => { settled = true; return { error }; },
  );

  await vi.advanceTimersByTimeAsync(660_000);
  expect(settled).toBe(false);
  expect(useAnalysisJobStore.getState().jobs[0]?.status).toBe("running");
  await vi.advanceTimersByTimeAsync(192_000);
  expect(await outcome).toEqual({ value: result });
  expect(useAnalysisJobStore.getState().jobs[0]?.status).toBe("succeeded");
  expect(apiClient.get).toHaveBeenLastCalledWith("/analysis-jobs/bali-job", { timeoutMs: 30_000, auth: "app" });
});

it("reports a failed job immediately instead of waiting for the extended budget", async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ job_id: "bali-job", status: "failed", error: "No valid vegetation pixels in AOI", http_status: 400 });
  const outcome = analyzeVegetation(aoi, 2026, params).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(3_000);
  const error = await outcome;
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ message: "No valid vegetation pixels in AOI", status: 400 });
  expect(useAnalysisJobStore.getState().jobs[0]?.status).toBe("failed");
});
