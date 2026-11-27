import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import ProjectAnalysisPanel from "./ProjectAnalysisPanel";
import * as api from "./analysisApi";
import * as dmrv from "./api";
import type { MonitoringPeriod } from "./types";

vi.mock("./analysisApi", () => ({
  listAnalysisRuns: vi.fn(),
  getWorkspaceUsage: vi.fn(),
  createAnalysisRun: vi.fn(),
  cancelAnalysisRun: vi.fn(),
}));
vi.mock("./api", () => ({
  listMonitoringPeriods: vi.fn(),
  newIdempotencyKey: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
}));
const period: MonitoringPeriod = {
  id: "period1",
  project_id: "project1",
  boundary_version: 1,
  boundary_checksum: "hash",
  name: "2026",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  status: "in_progress",
  revision: 1,
  created_at: null,
  updated_at: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  useI18nStore.getState().setLanguage("id");
  vi.mocked(dmrv.newIdempotencyKey).mockReturnValue("00000000-0000-4000-8000-000000000001");
  vi.mocked(dmrv.listMonitoringPeriods).mockResolvedValue([period]);
  vi.mocked(api.listAnalysisRuns).mockResolvedValue([]);
  vi.mocked(api.getWorkspaceUsage).mockResolvedValue({
    limit: 100,
    reserved: 0,
    used: 2,
    remaining: 98,
    cycle_start: "2026-11-01",
    timezone: "UTC",
    unit: "analysis_run",
    policy_version: "analysis_run_v1",
  });
});
afterEach(cleanup);

it("restores the authorized period from URL and submits a server-resolved context", async () => {
  render(
    <MemoryRouter initialEntries={["/?period=period1"]}>
      <ProjectAnalysisPanel projectId="project1" organizationId="org1" canRun />
    </MemoryRouter>,
  );
  expect(await screen.findByText("Belum ada pekerjaan untuk filter ini.")).toBeInTheDocument();
  expect(screen.getByLabelText("Periode monitoring")).toHaveValue("period1");
  fireEvent.click(screen.getByRole("button", { name: "Jalankan analisis" }));
  await waitFor(() =>
    expect(api.createAnalysisRun).toHaveBeenCalledWith(
      "project1",
      { kind: "carbon", monitoring_period_id: "period1", parameters: {} },
      "00000000-0000-4000-8000-000000000001",
    ),
  );
});

it("keeps the same idempotency key after an uncertain network failure", async () => {
  vi.mocked(api.createAnalysisRun).mockRejectedValueOnce(new Error("Network unavailable"));
  render(
    <MemoryRouter initialEntries={["/?period=period1"]}>
      <ProjectAnalysisPanel projectId="project1" organizationId="org1" canRun />
    </MemoryRouter>,
  );
  await screen.findByText("Belum ada pekerjaan untuk filter ini.");
  fireEvent.click(screen.getByRole("button", { name: "Jalankan analisis" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Jalankan analisis" }));
  await waitFor(() => expect(api.createAnalysisRun).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.createAnalysisRun).mock.calls.map((call) => call[2])).toEqual([
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000001",
  ]);
  expect(dmrv.newIdempotencyKey).toHaveBeenCalledTimes(1);
});

it("does not offer submit to a reader", async () => {
  render(
    <MemoryRouter>
      <ProjectAnalysisPanel projectId="project1" organizationId="org1" canRun={false} />
    </MemoryRouter>,
  );
  await screen.findByText("Belum ada pekerjaan untuk filter ini.");
  expect(screen.queryByRole("button", { name: "Jalankan analisis" })).not.toBeInTheDocument();
  expect(api.createAnalysisRun).not.toHaveBeenCalled();
});

function CurrentQuery() {
  return <output aria-label="query">{useLocation().search}</output>;
}

it("restores kind and baseline, preserves unrelated URL filters and resets pagination", async () => {
  vi.mocked(dmrv.listMonitoringPeriods).mockResolvedValue([
    period,
    { ...period, id: "baseline1", name: "2025", start_date: "2025-01-01", end_date: "2025-12-31" },
  ]);
  render(
    <MemoryRouter
      initialEntries={[
        "/?tab=analysis&period=period1&analysis_kind=landcover_transition&baseline_period=baseline1&analysis_page=3&basemap=satellite",
      ]}
    >
      <ProjectAnalysisPanel projectId="project1" organizationId="org1" canRun />
      <CurrentQuery />
    </MemoryRouter>,
  );
  await screen.findByText("Belum ada pekerjaan untuk filter ini.");
  expect(screen.getByLabelText("Jenis analisis")).toHaveValue("landcover_transition");
  expect(screen.getByLabelText("Tahun dasar")).toHaveValue("baseline1");
  expect(api.listAnalysisRuns).toHaveBeenCalledWith("project1", "period1", 20, 40);
  fireEvent.click(screen.getByRole("button", { name: "Jalankan analisis" }));
  await waitFor(() =>
    expect(api.createAnalysisRun).toHaveBeenCalledWith(
      "project1",
      {
        kind: "landcover_transition",
        monitoring_period_id: "period1",
        baseline_period_id: "baseline1",
        parameters: {},
      },
      expect.any(String),
    ),
  );
  fireEvent.change(screen.getByLabelText("Jenis analisis"), { target: { value: "vegetation" } });
  const query = new URLSearchParams(screen.getByLabelText("query").textContent || "");
  expect(query.get("basemap")).toBe("satellite");
  expect(query.get("tab")).toBe("analysis");
  expect(query.get("analysis_kind")).toBe("vegetation");
  expect(query.has("baseline_period")).toBe(false);
  expect(query.has("analysis_page")).toBe(false);
});

it.each(["missing", "planned"])("rejects unavailable URL period %s", async (id) => {
  vi.mocked(dmrv.listMonitoringPeriods).mockResolvedValue([
    period,
    { ...period, id: "planned", status: "planned" },
  ]);
  render(
    <MemoryRouter initialEntries={[`/?period=${id}`]}>
      <ProjectAnalysisPanel projectId="project1" organizationId="org1" canRun />
    </MemoryRouter>,
  );
  await screen.findByText("Belum ada pekerjaan untuk filter ini.");
  expect(screen.getByRole("button", { name: "Jalankan analisis" })).toBeDisabled();
  expect(api.createAnalysisRun).not.toHaveBeenCalled();
});

it("recovers from an empty trailing page and localizes job status", async () => {
  const row: api.AnalysisRun = {
    job: {
      id: "job1",
      project_id: "project1",
      kind: "analysis.carbon",
      status: "succeeded",
      progress: {},
      result: {},
      error: null,
      attempts: 1,
      cancel_requested: false,
      created_at: "2026-11-14T01:00:00Z",
      started_at: null,
      finished_at: null,
    },
    context_hash: "hash",
    context: {
      period: { id: "period1", start: "2026-01-01", end: "2026-12-31", revision: 1 },
      boundary: { id: "aoi1", version: 1, checksum: "hash", area_ha: 100 },
    },
  };
  vi.mocked(api.listAnalysisRuns).mockImplementation(async (_project, _period, _limit, offset) =>
    offset ? [] : [row],
  );
  render(
    <MemoryRouter initialEntries={["/?period=period1&analysis_page=2"]}>
      <ProjectAnalysisPanel projectId="project1" organizationId="org1" canRun />
    </MemoryRouter>,
  );
  await screen.findByText("Belum ada pekerjaan untuk filter ini.");
  expect(screen.getByRole("button", { name: "Berikutnya" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Sebelumnya" }));
  expect(await screen.findByText("Selesai")).toBeInTheDocument();
  expect(api.listAnalysisRuns).toHaveBeenLastCalledWith("project1", "period1", 20, 0);
});
