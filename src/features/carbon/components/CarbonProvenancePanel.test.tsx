import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { CarbonResult } from "../types";
import CarbonProvenancePanel from "./CarbonProvenancePanel";

beforeEach(() => useI18nStore.getState().setLanguage("id"));

describe("carbon analysis provenance panel", () => {
  it("links a carbon result to its scenes and preserves the reference-raster evidence label", () => {
    const result: CarbonResult = {
      carbon_estimated: { unit: "Mg C/ha", statistics: { mean: 10 } },
      area_info: {},
      analysis_snapshot_id: "run-123",
      model_info: { model_name: "model-a", model_version: "1.2", validation_type: "spatial_reference_holdout" },
      data_quality: { valid_pixel_pct: 80, gap_filled: false, images_used: 1,
        coefficient_of_variation_pct: null, model_r2: null, model_rmse: null,
        source_provenance: [{ provider: "Copernicus", collection_id: "COPERNICUS/S2_SR_HARMONIZED",
          scene_count: 1, scenes: [{ scene_id: "scene-1", acquired_at_utc: "2026-01-02T03:04:05+00:00" }] }] },
    };
    render(<CarbonProvenancePanel result={result} />);
    fireEvent.click(screen.getByText("Provenance dan validasi"));

    expect(screen.getByText("run-123")).toBeInTheDocument();
    expect(screen.getByText("Spatial holdout terhadap raster referensi")).toBeInTheDocument();
    expect(screen.getByText("scene-1")).toBeInTheDocument();
  });

  it("warns when source scene metadata is unavailable", () => {
    render(<CarbonProvenancePanel result={{ carbon_estimated: {}, area_info: {}, model_info: {} }} />);
    fireEvent.click(screen.getByText("Provenance dan validasi"));
    expect(screen.getByRole("status")).toHaveTextContent(/Metadata scene rinci tidak tersedia/);
    expect(screen.getByText("Belum divalidasi")).toBeInTheDocument();
  });
});
