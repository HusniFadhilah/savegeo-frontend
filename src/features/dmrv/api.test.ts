import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "@/services/apiClient";
import type { MonitoringPeriod } from "./types";
import {
  addBoundary,
  commitFieldImport,
  createMonitoringPeriod,
  createProject,
  createFieldSummaryJob,
  cancelDmrvJob,
  dmrvErrorCode,
  getArrIllustrativeExample,
  getDmrvSnapshot,
  listBoundaries,
  listDmrvJobs,
  listMonitoringPeriods,
  listVisits,
  newIdempotencyKey,
  previewFieldImport,
  updateMonitoringPeriod,
} from "./api";

vi.mock("@/services/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/apiClient")>();
  return { ...actual, apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), upload: vi.fn() } };
});

beforeEach(() => vi.clearAllMocks());

describe("dMRV api", () => {
  it("submits and reads durable field summary jobs and snapshots", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: "job-1" });
    vi.mocked(apiClient.get).mockResolvedValue([]);
    await createFieldSummaryJob("p-1", "job-key");
    await createFieldSummaryJob("p-1", "period-job-key", "period-1");
    await listDmrvJobs("p-1");
    await cancelDmrvJob("p-1", "job/1");
    await getDmrvSnapshot("p-1", "snap/1");
    expect(apiClient.post).toHaveBeenNthCalledWith(1, "/dmrv/projects/p-1/jobs", { kind: "field_summary" }, {
      auth: "app", headers: { "Idempotency-Key": "job-key" },
    });
    expect(apiClient.post).toHaveBeenNthCalledWith(2, "/dmrv/projects/p-1/jobs", {
      kind: "field_summary", monitoring_period_id: "period-1",
    }, { auth: "app", headers: { "Idempotency-Key": "period-job-key" } });
    expect(apiClient.get).toHaveBeenCalledWith("/dmrv/projects/p-1/jobs", { auth: "app" });
    expect(apiClient.post).toHaveBeenNthCalledWith(3, "/dmrv/projects/p-1/jobs/job%2F1/cancel", {}, { auth: "app" });
    expect(apiClient.get).toHaveBeenLastCalledWith("/dmrv/projects/p-1/snapshots/snap%2F1", { auth: "app" });
  });

  it("creates, lists, and advances a versioned monitoring period", async () => {
    const period: MonitoringPeriod = {
      id: "period-1", project_id: "p-1", boundary_version: 1, boundary_checksum: "abc", name: "2025",
      start_date: "2025-01-01", end_date: "2025-12-31", status: "planned", revision: 1,
      created_at: null, updated_at: null,
    };
    vi.mocked(apiClient.post).mockResolvedValue(period);
    vi.mocked(apiClient.get).mockResolvedValue([period]);
    vi.mocked(apiClient.patch).mockResolvedValue({ ...period, revision: 2, status: "in_progress" });
    const payload = { name: "2025", start_date: "2025-01-01", end_date: "2025-12-31", boundary_version: 1 };
    await createMonitoringPeriod("p-1", payload, "period-key");
    await listMonitoringPeriods("p-1");
    await updateMonitoringPeriod("p-1", period, "in_progress");
    expect(apiClient.post).toHaveBeenCalledWith("/dmrv/projects/p-1/monitoring-periods", payload, {
      auth: "app", headers: { "Idempotency-Key": "period-key" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/dmrv/projects/p-1/monitoring-periods", { auth: "app" });
    expect(apiClient.patch).toHaveBeenCalledWith("/dmrv/projects/p-1/monitoring-periods/period-1", { status: "in_progress" }, {
      auth: "app", headers: { "If-Match": '"1"' },
    });
  });

  it("loads the authenticated illustrative accounting example without a project id", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ qualification: "illustrative_only" });
    await getArrIllustrativeExample();
    expect(apiClient.get).toHaveBeenCalledWith("/dmrv/examples/arr-accounting", { auth: "app" });
  });

  it("creates a project with an idempotency key and app auth", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: "p-1" });
    await createProject({ name: "Pilot", methodology_id: "VM0047" }, "key-1");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/dmrv/projects",
      { name: "Pilot", methodology_id: "VM0047" },
      { auth: "app", headers: { "Idempotency-Key": "key-1" } },
    );
  });

  it("url-encodes ids and plot codes", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    await listBoundaries("a/b");
    await listVisits("p 1", "T1/2");
    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/dmrv/projects/a%2Fb/boundaries", { auth: "app" });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/dmrv/projects/p%201/field-data/plots/T1%2F2/visits", { auth: "app" });
  });

  it("posts boundaries as geojson plus reason", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({});
    await addBoundary("p-1", { type: "Polygon", coordinates: [] }, "initial");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/dmrv/projects/p-1/boundaries",
      { geojson: { type: "Polygon", coordinates: [] }, reason: "initial" },
      { auth: "app" },
    );
  });

  it("uploads field data for preview and commit", async () => {
    vi.mocked(apiClient.upload).mockResolvedValue({});
    const form = new FormData();
    await previewFieldImport("p-1", form);
    await commitFieldImport("p-1", form, "key-2");
    expect(apiClient.upload).toHaveBeenNthCalledWith(1, "/dmrv/projects/p-1/field-data/imports/preview", form, { auth: "app" });
    expect(apiClient.upload).toHaveBeenNthCalledWith(2, "/dmrv/projects/p-1/field-data/imports", form, {
      auth: "app",
      headers: { "Idempotency-Key": "key-2" },
    });
  });

  it("reads the server error code from an ApiError payload", () => {
    const error = new ApiError("Sudah dipakai", 422, { code: "idempotency_key_reused", message: "Sudah dipakai" });
    expect(dmrvErrorCode(error)).toBe("idempotency_key_reused");
    expect(dmrvErrorCode(new ApiError("x", 500, "plain"))).toBeNull();
    expect(dmrvErrorCode(new Error("x"))).toBeNull();
  });

  it("generates distinct idempotency keys of at most 64 characters", () => {
    const first = newIdempotencyKey();
    expect(first).not.toBe(newIdempotencyKey());
    expect(first.length).toBeLessThanOrEqual(64);
  });
});
