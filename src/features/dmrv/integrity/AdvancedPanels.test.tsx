import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import { getMethodologyChecklist } from "./api";
import { MethodologyPanel } from "./AdvancedPanels";
import type { MethodologyChecklist } from "./types";

vi.mock("./api", async (original) => ({
  ...await original<typeof import("./api")>(),
  getMethodologyChecklist: vi.fn(),
}));

const checklist: MethodologyChecklist = {
  methodology_id: "VM0047",
  methodology_version: "1.1",
  supported: true,
  pack_id: "verra-vm0047-v1.1-savegeo-review-aid",
  reviewed_on: null,
  source_checked_on: "2026-11-28",
  official_sources: [{
    id: "vm0047_v1_1",
    title: "VM0047 Afforestation, Reforestation, and Revegetation",
    title_id: "VM0047 Aforestasi, Reforestasi, dan Revegetasi",
    version: "1.1",
    document_date: "2025-05-14",
    effective_date: "2025-05-14",
    url: "https://verra.org/wp-content/uploads/2025/05/VM0047-v1.1_Final.pdf",
    landing_page: "https://verra.org/methodologies/vm0047-afforestation-reforestation-and-revegetation-v1-1/",
  }],
  expert_review_status: "not_recorded_for_pack",
  approach: "area_based",
  approach_options: ["area_based", "census_based"],
  items: [{
    key: "approach",
    title: "Approach and applicability",
    title_id: "Pendekatan dan penerapan",
    description: "Record the selected approach.",
    description_id: "Catat pendekatan yang dipilih.",
    source: "https://verra.org/methodologies/vm0047-afforestation-reforestation-and-revegetation-v1-1/",
    required: true,
    status: "not_assessed",
    notes: "",
    evidence: [],
  }],
  record_id: null,
  revision: 0,
  record_status: null,
  qualification: "Internal review aid.",
  qualification_id: "internal_review_aid",
};

const renderPanel = () => render(<MethodologyPanel
  projectId="project-1"
  records={[]}
  canWrite={false}
  canReview={false}
  onChanged={async () => undefined}
/>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMethodologyChecklist).mockResolvedValue(checklist);
});
afterEach(cleanup);

it("shows source check dates and Indonesian methodology labels without implying expert approval", async () => {
  useI18nStore.getState().setLanguage("id");
  renderPanel();

  expect(await screen.findByText("Pendekatan dan penerapan")).toBeInTheDocument();
  expect(screen.getByText("Sumber resmi diperiksa: 2026-11-28")).toBeInTheDocument();
  expect(screen.getByText(/Review ahli\/VVB untuk paket daftar ini belum tercatat/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /VM0047 Aforestasi, Reforestasi, dan Revegetasi v1.1/ }))
    .toHaveAttribute("href", checklist.official_sources[0].url);
  expect(screen.queryByText("Reviewed: 2026-11-28")).not.toBeInTheDocument();
});

it("localizes methodology qualification and labels in English", async () => {
  useI18nStore.getState().setLanguage("en");
  renderPanel();

  expect(await screen.findByText("Approach and applicability")).toBeInTheDocument();
  expect(screen.getByText("Official sources checked: 2026-11-28")).toBeInTheDocument();
  expect(screen.getByText(/No expert\/VVB review of this checklist pack is recorded/)).toBeInTheDocument();
  expect(screen.getByText(/Internal checklist based on the linked Verra sources/)).toBeInTheDocument();
});
