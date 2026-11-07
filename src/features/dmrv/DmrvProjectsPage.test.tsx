import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/apiClient";
import { useI18nStore } from "@/hooks/useI18nStore";
import DmrvProjectsPage from "./DmrvProjectsPage";
import * as api from "./api";
import type { Project } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, listProjects: vi.fn(), createProject: vi.fn(), newIdempotencyKey: vi.fn(() => "key-1") };
});
vi.mock("@/components/layout/DashboardShell", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

const project = (over: Partial<Project> = {}): Project => ({
  id: "p-1", name: "Pilot ARR", organization: "UNDIP", activity_type: "ARR", jurisdiction: null,
  methodology_id: "VM0047", methodology_version: null, start_date: null, crediting_period_years: null,
  status: "draft", revision: 1, created_at: null, updated_at: null, my_role: "project_owner", ...over,
});
const renderPage = () => render(<MemoryRouter><DmrvProjectsPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
});
afterEach(cleanup);

describe("DmrvProjectsPage", () => {
  it("lists the member's projects with role and a link to the workspace", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([project()]);
    renderPage();
    const link = await screen.findByRole("link", { name: "Pilot ARR" });
    expect(link).toHaveAttribute("href", "/dmrv/projects/p-1");
    expect(screen.getByRole("link", { name: "Contoh accounting ARR area tetap (ilustrasi)" })).toHaveAttribute("href", "/dmrv/examples/arr-accounting");
    expect(screen.getByText("Pemilik proyek")).toBeInTheDocument();
  });

  it("shows an empty state that points at the create form", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/Belum ada proyek/)).toBeInTheDocument();
    expect(screen.getByLabelText("Nama proyek")).toBeInTheDocument();
  });

  it("creates one project on a double click, with one idempotency key", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([]);
    let release!: (value: Project) => void;
    vi.mocked(api.createProject).mockReturnValue(new Promise<Project>((resolve) => { release = resolve; }));
    renderPage();
    await screen.findByText(/Belum ada proyek/);
    fireEvent.change(screen.getByLabelText("Nama proyek"), { target: { value: "  Pilot ARR  " } });
    const submit = screen.getByRole("button", { name: "Buat proyek" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(api.createProject).toHaveBeenCalledTimes(1);
    expect(api.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Pilot ARR", methodology_id: "VM0047", activity_type: "ARR" }),
      "key-1",
    );
    release(project());
    expect(await screen.findByRole("status")).toHaveTextContent("Proyek dibuat.");
    expect(screen.getByRole("link", { name: "Pilot ARR" })).toBeInTheDocument();
  });

  it("explains a 403 on create without leaking server internals", async () => {
    vi.mocked(api.listProjects).mockResolvedValue([]);
    vi.mocked(api.createProject).mockRejectedValue(new ApiError("Akun ini tidak diizinkan", 403, { code: "forbidden" }));
    renderPage();
    await screen.findByText(/Belum ada proyek/);
    fireEvent.change(screen.getByLabelText("Nama proyek"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat proyek" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Akun ini tidak diizinkan membuat proyek dMRV.");
  });

  it("shows the server code for other failures and a generic message for unknown ones", async () => {
    vi.mocked(api.listProjects).mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Permintaan gagal. Coba lagi.");
    cleanup();
    vi.mocked(api.listProjects).mockResolvedValue([]);
    vi.mocked(api.createProject).mockRejectedValue(new ApiError("dup", 422, { code: "idempotency_key_reused", message: "Kunci dipakai ulang" }));
    renderPage();
    await screen.findByText(/Belum ada proyek/);
    fireEvent.change(screen.getByLabelText("Nama proyek"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Buat proyek" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("idempotency_key_reused: Kunci dipakai ulang"));
  });
});
