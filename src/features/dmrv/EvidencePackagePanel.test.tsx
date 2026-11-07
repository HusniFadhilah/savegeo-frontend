import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import EvidencePackagePanel from "./EvidencePackagePanel";
import * as api from "./api";
import type { DmrvJob, EvidencePackage } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    createEvidencePackage: vi.fn(),
    listDmrvJobs: vi.fn(),
    listEvidencePackages: vi.fn(),
    newIdempotencyKey: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
    verifyEvidencePackage: vi.fn(),
  };
});

const succeeded: DmrvJob = {
  id: "job-1", project_id: "p-1", kind: "field_summary", status: "succeeded", progress: {},
  result: { snapshot_id: "snap-1" }, error: null, attempts: 1, cancel_requested: false,
  created_at: null, started_at: null, finished_at: null,
};

const evidence: EvidencePackage = {
  id: "package-1", project_id: "p-1", snapshot_id: "snap-1",
  manifest: {
    snapshot: { id: "snap-1", kind: "field_summary", sha256: "snapshot-hash" },
    components: [{ name: "methodology_mapping_and_approval", status: "missing" }],
    entries: [{ path: "snapshot/inputs.json", size_bytes: 2, sha256: "entry-hash" }],
    verification_status: "not_verified", issuance_status: "not_issued",
  },
  manifest_hash: "manifest-hash", package_sha256: "package-hash",
  missing_components: ["methodology_mapping_and_approval"], readiness: "incomplete",
  created_by: "admin:1", created_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listDmrvJobs).mockResolvedValue([succeeded]);
  vi.mocked(api.listEvidencePackages).mockResolvedValue([evidence]);
  vi.mocked(api.createEvidencePackage).mockResolvedValue(evidence);
  vi.mocked(api.verifyEvidencePackage).mockResolvedValue({
    package_id: evidence.id, valid: true, code: null, checked_entries: 1,
  });
  vi.mocked(api.newIdempotencyKey).mockReturnValue("00000000-0000-4000-8000-000000000001");
  useI18nStore.getState().setLanguage("id");
});
afterEach(cleanup);

describe("EvidencePackagePanel", () => {
  it("builds from a completed snapshot, shows blockers, verifies and links the ZIP", async () => {
    render(<EvidencePackagePanel projectId="p-1" canWrite />);
    expect(await screen.findByText(/Belum lengkap/)).toBeInTheDocument();
    expect(screen.getByText("Pemetaan metodologi dan persetujuan ahli")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Unduh ZIP" })).toHaveAttribute(
      "href", "/api/dmrv/projects/p-1/evidence-packages/package-1/download",
    );

    fireEvent.click(screen.getByRole("button", { name: "Verifikasi checksum" }));
    expect(await screen.findByText("Manifest dan checksum entri cocok.")).toBeInTheDocument();
    expect(api.verifyEvidencePackage).toHaveBeenCalledWith("p-1", "package-1");

    fireEvent.click(screen.getByRole("button", { name: "Buat paket ZIP" }));
    await waitFor(() => expect(api.createEvidencePackage).toHaveBeenCalledWith("p-1", "snap-1", "00000000-0000-4000-8000-000000000001"));
    expect(await screen.findByText("Paket dibuat, tetapi masih ada komponen wajib yang belum tersedia.")).toBeInTheDocument();
  });

  it("keeps evidence creation read-only for a reviewer", async () => {
    render(<EvidencePackagePanel projectId="p-1" canWrite={false} />);
    expect(await screen.findByText(/Belum lengkap/)).toBeInTheDocument();
    expect(screen.getByText("Peran Anda hanya dapat melihat paket bukti.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buat paket ZIP" })).not.toBeInTheDocument();
  });
});
