import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import SubmissionReviewPanel from "./SubmissionReviewPanel";
import * as api from "./api";
import type { DmrvReviewFinding, DmrvSubmission, EvidencePackage } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    createDmrvFinding: vi.fn(),
    createSubmissionDraft: vi.fn(),
    decideDmrvSubmission: vi.fn(),
    listDmrvFindings: vi.fn(),
    listDmrvSubmissions: vi.fn(),
    listEvidencePackages: vi.fn(),
    newIdempotencyKey: vi.fn(() => "00000000-0000-4000-8000-000000000002"),
    resolveDmrvFinding: vi.fn(),
    respondDmrvFinding: vi.fn(),
    startDmrvReview: vi.fn(),
    submitDmrvSubmission: vi.fn(),
  };
});

const packageRow: EvidencePackage = {
  id: "package-1", project_id: "p-1", snapshot_id: "snap-1",
  manifest: {
    snapshot: { id: "snap-1", kind: "field_summary", sha256: "snapshot-hash" },
    components: [], entries: [], verification_status: "not_verified", issuance_status: "not_issued",
  },
  manifest_hash: "manifest-hash", package_sha256: "package-hash",
  missing_components: ["methodology_mapping_and_approval"], readiness: "incomplete",
  created_by: "admin:1", created_at: null,
};

const submission: DmrvSubmission = {
  id: "submission-1", project_id: "p-1", version: 1, evidence_package_id: packageRow.id,
  locked_snapshot_hash: "snapshot-hash", locked_manifest_hash: "manifest-hash", status: "draft",
  created_by: "admin:1", reviewer_key: null, supersedes_id: null, revision: 1,
  decision_reason: null, created_at: null, submitted_at: null, decided_at: null,
};

const finding: DmrvReviewFinding = {
  id: "finding-1", submission_id: submission.id, code: "DATA_NOTE", message: "Add source provenance.",
  status: "open", due_date: null, response: null, evidence_references: [], created_by: "user:1",
  responded_by: null, resolved_by: null, created_at: null, updated_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
  vi.mocked(api.listEvidencePackages).mockResolvedValue([packageRow]);
  vi.mocked(api.listDmrvSubmissions).mockResolvedValue([submission]);
  vi.mocked(api.listDmrvFindings).mockResolvedValue([]);
  vi.mocked(api.createSubmissionDraft).mockResolvedValue(submission);
  vi.mocked(api.createDmrvFinding).mockResolvedValue(finding);
});
afterEach(cleanup);

describe("SubmissionReviewPanel", () => {
  it("keeps draft submission disabled until its evidence package is complete", async () => {
    render(<SubmissionReviewPanel projectId="p-1" canSubmit canReview={false} />);
    expect(await screen.findByRole("heading", { name: "Submission v1" })).toBeInTheDocument();
    expect(screen.getByText(/Paket bukti belum lengkap/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kirim untuk review" })).toBeDisabled();
  });

  it("lets an assigned reviewer record a finding while review is active", async () => {
    vi.mocked(api.listDmrvSubmissions).mockResolvedValue([{ ...submission, status: "under_review", reviewer_key: "user:1" }]);
    vi.mocked(api.listDmrvFindings).mockResolvedValue([]);
    render(<SubmissionReviewPanel projectId="p-1" canSubmit={false} canReview />);
    expect(await screen.findByText(/Dalam review/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Kode temuan"), { target: { value: "DATA_NOTE" } });
    fireEvent.change(screen.getByLabelText("Isi temuan"), { target: { value: "Provide source provenance." } });
    fireEvent.click(screen.getByRole("button", { name: "Tambah temuan" }));
    await waitFor(() => expect(api.createDmrvFinding).toHaveBeenCalledWith(
      "p-1", "submission-1", { code: "DATA_NOTE", message: "Provide source provenance." }, "00000000-0000-4000-8000-000000000002",
    ));
  });
});
