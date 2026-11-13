import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import { getProject, listDmrvJobs, listMonitoringPeriods } from "../api";
import type { Project } from "../types";
import { getWorkspace } from "./api";
import IntegrityPage from "./IntegrityPage";
import type { IntegrityWorkspace } from "./types";

vi.mock("@/components/layout/DashboardShell", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("../api", async (original) => ({ ...await original<typeof import("../api")>(), getProject: vi.fn(), listMonitoringPeriods: vi.fn(), listDmrvJobs: vi.fn() }));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), getWorkspace: vi.fn() }));
const project: Project = { id: "p1", name: "Pilot integrity", organization: "Example", activity_type: "ARR", jurisdiction: null, methodology_id: "DEMO", methodology_version: "1", start_date: null, crediting_period_years: null, status: "draft", revision: 1, created_at: null, updated_at: null, my_role: "project_owner" };
const workspace: IntegrityWorkspace = { project_id: "p1", catalog: [{ category: "readiness", key: "legal_entity", title: "Legalitas", title_en: "Legal identity", required: true }], readiness: { score_pct: 0, accepted: 0, submitted: 0, total: 16, blockers: [], qualification: "internal" }, records: [], documents: [], risk_policy: { enabled: false, interval_days: 7, lookback_days: 30, tree_loss_threshold_ha: 1, min_observations: 3, revision: 0, next_run_at: null, last_enqueued_at: null }, registry_check: { serial_conflicts: [], overlapping_projects: 0, unique_overlap_ha: 0, boundary_version: null, external_registry_status: "not_connected", qualification: "internal" } };
const renderPage = () => render(<MemoryRouter initialEntries={["/dmrv/projects/p1/integrity"]}><Routes><Route path="/dmrv/projects/:projectId/integrity" element={<IntegrityPage />} /></Routes></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); useI18nStore.getState().setLanguage("id"); vi.mocked(getProject).mockResolvedValue(project); vi.mocked(getWorkspace).mockResolvedValue(workspace); vi.mocked(listMonitoringPeriods).mockResolvedValue([]); vi.mocked(listDmrvJobs).mockResolvedValue([]); });
afterEach(cleanup);

it("connects the project page to every integrity workflow without a sidebar entry", async () => {
  renderPage();
  expect(await screen.findByRole("heading", { name: "Pilot integrity" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Portofolio proyek" })).toHaveAttribute("href", "/dmrv/portfolio");
  expect(screen.getByText("Legalitas")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mitigasi" }));
  expect(screen.getByRole("heading", { name: "Perhitungan baru" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Registry" }));
  expect(screen.getByRole("heading", { name: "Rekonsiliasi catatan registry" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Validasi" }));
  expect(screen.getByRole("heading", { name: "Dataset validasi baru" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Safeguards" }));
  expect(screen.getByRole("heading", { name: "Register pengaduan" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dokumen" }));
  expect(screen.getByLabelText("Unggah dokumen bukti")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Risiko" }));
  expect(screen.getByRole("heading", { name: "Jadwal dan ambang monitoring" })).toBeInTheDocument();
});

it("keeps input forms and project settings out of reviewer mode", async () => {
  vi.mocked(getProject).mockResolvedValue({ ...project, my_role: "reviewer" });
  renderPage();
  await screen.findByRole("heading", { name: "Pilot integrity" });
  expect(screen.getByText("Mode reviewer")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tambahkan bukti" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Pengaturan" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mitigasi" }));
  expect(screen.queryByRole("heading", { name: "Perhitungan baru" })).not.toBeInTheDocument();
});
