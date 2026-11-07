import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import FieldSummaryJobPanel from "./FieldSummaryJobPanel";
import * as api from "./api";
import type { DmrvJob, DmrvSnapshot } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    cancelDmrvJob: vi.fn(),
    createFieldSummaryJob: vi.fn(),
    getDmrvSnapshot: vi.fn(),
    listDmrvJobs: vi.fn(),
    listMonitoringPeriods: vi.fn(),
    newIdempotencyKey: vi.fn(() => "job-key"),
  };
});

const queued: DmrvJob = {
  id: "job-1", project_id: "p-1", kind: "field_summary", status: "queued", progress: {},
  result: null, error: null, attempts: 0, cancel_requested: false,
  created_at: null, started_at: null, finished_at: null,
};
const succeeded: DmrvJob = {
  ...queued, status: "succeeded", result: { snapshot_id: "snap-1", snapshot_hash: "abc123" },
};
const snapshot: DmrvSnapshot = {
  id: "snap-1", project_id: "p-1", job_id: "job-1", kind: "field_summary", inputs: {},
  outputs: { counts: { plots_total: 1, plots_with_density: 1, plots_blocked: 0 } },
  snapshot_hash: "abc123def456", created_by: "admin:1", created_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
});
afterEach(cleanup);

describe("FieldSummaryJobPanel", () => {
  it("submits a durable job, shows its status, and reads the immutable snapshot", async () => {
    vi.mocked(api.listDmrvJobs).mockResolvedValueOnce([queued]).mockResolvedValueOnce([succeeded]);
    vi.mocked(api.listMonitoringPeriods).mockResolvedValue([]);
    vi.mocked(api.createFieldSummaryJob).mockResolvedValue(succeeded);
    vi.mocked(api.getDmrvSnapshot).mockResolvedValue(snapshot);
    render(<FieldSummaryJobPanel projectId="p-1" canRun />);

    expect(await screen.findByText("Dalam antrean")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buat snapshot" }));
    await waitFor(() => expect(api.createFieldSummaryJob).toHaveBeenCalledWith("p-1", "job-key", undefined));
    expect(await screen.findByText("Selesai")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lihat snapshot" }));
    expect(await screen.findByText("abc123def456")).toBeInTheDocument();
    expect(screen.getAllByText("1", { selector: "dd" })).toHaveLength(2);
    expect(screen.getByText(/bukan stok karbon terverifikasi/)).toBeInTheDocument();
  });
});
