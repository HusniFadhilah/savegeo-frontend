import { beforeEach, expect, it, vi } from "vitest";
import { runAnalysisJob } from "./analysisJobs";
import { useAnalysisJobStore } from "./analysisJobStore";
import { apiClient } from "./apiClient";
vi.mock("./apiClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("./apiClient")>();
  return { ...original, apiClient: { post: vi.fn(), get: vi.fn() } };
});
beforeEach(() => {
  vi.clearAllMocks();
  useAnalysisJobStore.setState({ jobs: [] });
});
it("tracks real queued/running/succeeded states with backend job ID", async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    job_id: "job-1",
    status: "queued",
    status_url: "/analysis-jobs/job-1",
  });
  vi.mocked(apiClient.get)
    .mockResolvedValueOnce({ status: "running" })
    .mockResolvedValueOnce({ status: "succeeded", result: { tile_url: "/tiles" } });
  const statuses: string[] = [];
  const dispose = useAnalysisJobStore.subscribe((s) => {
    statuses.push(s.jobs[0].status);
  });
  try {
    await expect(
      runAnalysisJob("landcover", {}, { timeoutMs: 1000, pollIntervalMs: 1 }),
    ).resolves.toEqual({ tile_url: "/tiles" });
    expect(statuses).toEqual(["queued", "running", "succeeded"]);
    expect(useAnalysisJobStore.getState().jobs[0].job_id).toBe("job-1");
  } finally {
    dispose();
  }
});
it("keeps failed job reference and never supplies invented results", async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    job_id: "job-2",
    status: "queued",
    status_url: "/analysis-jobs/job-2",
  });
  vi.mocked(apiClient.get).mockResolvedValue({
    status: "failed",
    error: "No scenes for this period",
    http_status: 404,
  });
  await expect(
    runAnalysisJob("landcover", {}, { timeoutMs: 1000, pollIntervalMs: 1 }),
  ).rejects.toThrow("No scenes");
  expect(useAnalysisJobStore.getState().jobs[0]).toMatchObject({
    job_id: "job-2",
    status: "failed",
  });
});
