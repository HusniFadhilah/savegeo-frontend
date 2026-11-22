import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { MonitoringPeriod, Project } from "../types";
import AccountingPanel from "./AccountingPanel";
import ChecklistPanel from "./ChecklistPanel";
import PortfolioPage from "./PortfolioPage";
import { RecordActions } from "./shared";

import * as api from "./api";
import type { IntegrityRecord } from "./types";

vi.mock("./api", () => ({
  saveRecord: vi.fn(),
  getPortfolio: vi.fn(),
  getPortfolioDashboard: vi.fn(),
  reviewRecord: vi.fn(),
  getHistory: vi.fn(),
  getRecord: vi.fn(),
  saveBlob: vi.fn(),
}));
vi.mock("../api", () => ({ newIdempotencyKey: () => "new-record-key" }));
vi.mock("@/components/layout/DashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
const project: Project = {
  id: "p1",
  name: "ARR pilot",
  organization: "Test",
  activity_type: "ARR",
  jurisdiction: null,
  methodology_id: "DEMO",
  methodology_version: "1",
  start_date: null,
  crediting_period_years: null,
  status: "draft",
  revision: 1,
  created_at: null,
  updated_at: null,
  my_role: "project_owner",
};
const record: IntegrityRecord = {
  id: "r1",
  project_id: "p1",
  category: "readiness",
  record_key: "legal_entity",
  title: "Legalitas",
  payload: { summary: "Evidence summary", evidence: ["https://example.org/proof"] },
  result: {},
  status: "submitted",
  revision: 1,
  created_by: "admin:1",
  updated_by: "admin:1",
  reviewed_by: null,
  review_reason: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};
const changed = vi.fn(async () => undefined);
const props = {
  projectId: "p1",
  records: [],
  canWrite: true,
  canReview: false,
  onChanged: changed,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getPortfolioDashboard).mockResolvedValue({
    summary: { project_count: 0, job_count: 0, report_count: 0, submission_count: 0, risk_count: 0, period_count: 0, jobs_by_status: {}, reports_ready: 0 },
    projects: [], recent_jobs: [], recent_periods: [], recent_reports: [], recent_submissions: [], recent_risks: [],
  });
  useI18nStore.getState().setLanguage("id");
});
afterEach(cleanup);

describe("project integrity", () => {
  it("submits readiness evidence with its reference and keeps draft and review actions distinct", async () => {
    vi.mocked(api.saveRecord).mockResolvedValue(record);
    render(
      <ChecklistPanel
        {...props}
        catalog={[
          {
            category: "readiness",
            key: "legal_entity",
            title: "Legalitas",
            title_en: "Legal identity",
            required: true,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tambahkan bukti" }));
    fireEvent.change(screen.getByLabelText("Ringkasan bukti"), {
      target: { value: "Legal document supplied" },
    });
    fireEvent.change(screen.getByLabelText(/Rujukan bukti/), {
      target: { value: "https://example.org/proof" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajukan review" }));
    await waitFor(() =>
      expect(api.saveRecord).toHaveBeenCalledWith(
        "p1",
        "readiness",
        "legal_entity",
        expect.objectContaining({
          status: "submitted",
          payload: expect.objectContaining({ evidence: ["https://example.org/proof"] }),
        }),
        0,
      ),
    );
    expect(changed).toHaveBeenCalledOnce();
  });

  it("requires a review reason and sends the displayed revision", async () => {
    vi.mocked(api.reviewRecord).mockResolvedValue({ ...record, revision: 2, status: "accepted" });
    render(
      <RecordActions
        projectId="p1"
        record={record}
        canWrite={false}
        canReview
        onChanged={changed}
      />,
    );
    expect(screen.queryByRole("button", { name: "Ajukan review" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Terima" }));
    fireEvent.change(screen.getByLabelText("Alasan keputusan / tindak lanjut"), {
      target: { value: "Evidence checked independently" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan keputusan" }));
    await waitFor(() =>
      expect(api.reviewRecord).toHaveBeenCalledWith(
        "p1",
        record,
        "accepted",
        "Evidence checked independently",
      ),
    );
  });

  it("preserves unknown accounting inputs as null and documents excluded pools", async () => {
    vi.mocked(api.saveRecord).mockResolvedValue({ ...record, category: "accounting" });
    render(
      <AccountingPanel
        {...props}
        project={project}
        periods={[{ id: "period1", name: "2025", boundary_version: 1 } as MonitoringPeriod]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Nama perhitungan"), {
      target: { value: "Test calculation" },
    });
    fireEvent.change(screen.getByLabelText("Periode monitoring"), { target: { value: "period1" } });
    fireEvent.change(screen.getByLabelText("Sumber profil / aturan"), {
      target: { value: "https://example.org/rules" },
    });
    fireEvent.change(screen.getByLabelText("Dasar penerapan aturan dan pengurangan"), {
      target: { value: "Documented screening rules" },
    });
    for (const pool of ["BGB", "SOC", "litter", "deadwood"])
      fireEvent.click(screen.getByLabelText(pool));
    fireEvent.change(screen.getByLabelText("Alasan pool dikecualikan"), {
      target: { value: "Not measured in this example" },
    });
    for (const label of ["Proyek awal", "Proyek akhir", "Baseline awal", "Baseline akhir"])
      fireEvent.change(screen.getByLabelText(`AGB ${label}`), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Hitung dan simpan draft" }));
    await waitFor(() =>
      expect(api.saveRecord).toHaveBeenCalledWith(
        "p1",
        "accounting",
        "new-record-key",
        expect.objectContaining({
          payload: expect.objectContaining({
            project_emissions_tco2e: null,
            leakage_tco2e: null,
            uncertainty_deduction_pct: null,
            buffer_pct: null,
            excluded_pools_reason: "Not measured in this example",
          }),
        }),
        0,
      ),
    );
  });

  it("shows a safe empty portfolio and performs explicit searches", async () => {
    vi.mocked(api.getPortfolio).mockResolvedValue({
      total: 0,
      limit: 50,
      offset: 0,
      items: [],
      summary: { projects: 0, open_risks: 0, overdue_periods: 0 },
    });
    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Belum ada proyek yang dapat ditampilkan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ekspor halaman CSV" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cari proyek"), { target: { value: "Restoration" } });
    fireEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => expect(api.getPortfolio).toHaveBeenLastCalledWith("Restoration", 0));
  });

  it("renders English copy and surfaces API errors without a success state", async () => {
    useI18nStore.getState().setLanguage("en");
    vi.mocked(api.getPortfolio).mockRejectedValue(new Error("Access unavailable"));
    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Access unavailable");
    expect(screen.getByRole("heading", { name: "Carbon project portfolio" })).toBeInTheDocument();
    expect(screen.queryByText(/No matching projects/)).not.toBeInTheDocument();
  });
});
