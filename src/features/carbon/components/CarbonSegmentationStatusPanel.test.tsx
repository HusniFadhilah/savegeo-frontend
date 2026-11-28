import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import { listCarbonSegmentationModels } from "@/features/carbon/api";
import CarbonSegmentationStatusPanel from "./CarbonSegmentationStatusPanel";

vi.mock("@/features/carbon/api", () => ({
  listCarbonSegmentationModels: vi.fn(),
}));

beforeEach(() => {
  useI18nStore.getState().setLanguage("id");
  vi.mocked(listCarbonSegmentationModels).mockResolvedValue([{
    id: "savegeo_carbon_unet_v1",
    name: "SaveGeo U-Net land-cover segmentation",
    architecture: "U-Net encoder-decoder",
    release_status: "experimental_unvalidated",
    inference_available: false,
    weights_available: false,
    class_schema: "DYNAMIC_WORLD_9_CLASS",
    class_schema_version: "1",
    class_order: ["0", "1"],
    class_map: { "0": { label: "Water", color: "#419BDF" }, "1": { label: "Trees", color: "#397D49" } },
    label_source: null,
    label_license: null,
    sensor_mode: "optical_only",
    channel_order: ["B2", "B3", "B4", "B8", "B11", "B12"],
    sensor_modes_evaluated: [],
    validation: { type: "not_validated", metrics: null, holdout: null },
    availability_reason: "Bobot dan dataset label belum dikonfigurasi.",
  }]);
});

describe("carbon segmentation status", () => {
  it("shows U-Net separately and keeps inference unavailable without weights/evaluation", async () => {
    render(<CarbonSegmentationStatusPanel />);
    fireEvent.click(screen.getByText("Model segmentasi tutupan lahan"));
    await waitFor(() => expect(screen.getByText("SaveGeo U-Net land-cover segmentation")).toBeInTheDocument());

    expect(screen.getByText("Eksperimental · belum tervalidasi")).toBeInTheDocument();
    expect(screen.getByText(/Tidak tersedia untuk inferensi/)).toBeInTheDocument();
    expect(screen.getByText(/belum tersedia/)).toBeInTheDocument();
  });

  it("shows fetch failures in an accessible alert", async () => {
    vi.mocked(listCarbonSegmentationModels).mockRejectedValueOnce(new Error("API unavailable"));
    render(<CarbonSegmentationStatusPanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("API unavailable"));
  });
});
