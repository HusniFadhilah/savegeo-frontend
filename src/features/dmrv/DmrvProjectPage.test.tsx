import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/apiClient";
import { useI18nStore } from "@/hooks/useI18nStore";
import DmrvProjectPage from "./DmrvProjectPage";
import * as api from "./api";
import type { Project, ProjectRole } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, getProject: vi.fn() };
});
vi.mock("./BoundaryPanel", () => ({ default: ({ canWrite }: { canWrite: boolean }) => <div>boundary-panel write={String(canWrite)}</div> }));
vi.mock("./FieldDataPanel", () => ({ default: ({ canWrite }: { canWrite: boolean }) => <div>field-panel write={String(canWrite)}</div> }));
vi.mock("./EvidencePackagePanel", () => ({ default: ({ canWrite }: { canWrite: boolean }) => <div>evidence-panel write={String(canWrite)}</div> }));
vi.mock("./SubmissionReviewPanel", () => ({ default: ({ canSubmit, canReview }: { canSubmit: boolean; canReview: boolean }) => <div>review-panel submit={String(canSubmit)} review={String(canReview)}</div> }));
vi.mock("@/components/layout/DashboardShell", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

const project = (role: ProjectRole | null = "project_owner"): Project => ({
  id: "p-1", name: "Pilot ARR", organization: "UNDIP", activity_type: "ARR", jurisdiction: null,
  methodology_id: "VM0047", methodology_version: "1.1", start_date: null, crediting_period_years: null,
  status: "draft", revision: 3, created_at: null, updated_at: null, my_role: role,
});
const renderPage = () => render(
  <MemoryRouter initialEntries={["/dmrv/projects/p-1"]}>
    <Routes><Route path="/dmrv/projects/:projectId" element={<DmrvProjectPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
});
afterEach(cleanup);

describe("DmrvProjectPage", () => {
  it("shows the project header with the member's role and the overview by default", async () => {
    vi.mocked(api.getProject).mockResolvedValue(project());
    renderPage();
    expect(await screen.findByRole("heading", { name: "Pilot ARR" })).toBeInTheDocument();
    expect(screen.getByText("Pemilik proyek")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ringkasan" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("VM0047 1.1")).toBeInTheDocument();
    expect(api.getProject).toHaveBeenCalledWith("p-1");
  });

  it("shows one neutral not-found state for a missing project or a non-member", async () => {
    vi.mocked(api.getProject).mockRejectedValue(new ApiError("Proyek tidak ditemukan.", 404, { code: "not_found" }));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Proyek tidak ditemukan, atau Anda bukan anggotanya.");
    expect(screen.getByRole("link", { name: "Semua proyek" })).toHaveAttribute("href", "/dmrv/projects");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("switches between sections", async () => {
    vi.mocked(api.getProject).mockResolvedValue(project());
    renderPage();
    await screen.findByRole("heading", { name: "Pilot ARR" });
    fireEvent.click(screen.getByRole("tab", { name: "Batas wilayah" }));
    expect(screen.getByRole("tab", { name: "Batas wilayah" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("boundary-panel write=true")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Data lapangan" }));
    expect(screen.getByText("field-panel write=true")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Paket bukti" }));
    expect(screen.getByText("evidence-panel write=true")).toBeInTheDocument();
    expect(screen.getByText("review-panel submit=true review=false")).toBeInTheDocument();
    expect(screen.queryByText(/boundary-panel/)).not.toBeInTheDocument();
  });

  it.each([
    ["project_owner", true, true],
    ["analyst", true, false],
    ["field_operator", false, true],
    ["reviewer", false, false],
    ["verifier", false, false],
  ] as const)("gates write forms by role: %s", async (role, boundaryWrite, fieldWrite) => {
    vi.mocked(api.getProject).mockResolvedValue(project(role));
    renderPage();
    await screen.findByRole("heading", { name: "Pilot ARR" });
    fireEvent.click(screen.getByRole("tab", { name: "Batas wilayah" }));
    expect(screen.getByText(`boundary-panel write=${boundaryWrite}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Data lapangan" }));
    expect(screen.getByText(`field-panel write=${fieldWrite}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Paket bukti" }));
    expect(screen.getByText(`evidence-panel write=${role === "project_owner" || role === "analyst"}`)).toBeInTheDocument();
    expect(screen.getByText(`review-panel submit=${role === "project_owner" || role === "analyst"} review=${role === "reviewer" || role === "verifier"}`)).toBeInTheDocument();
  });
});
