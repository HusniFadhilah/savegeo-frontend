import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import CarbonCalibrationPanel from "./CarbonCalibrationPanel";
import { listCarbonCalibrationModels } from "@/features/carbon/api";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { CarbonModelListItem, CarbonParams } from "@/features/carbon/types";

vi.mock("@/features/carbon/api", () => ({ listCarbonCalibrationModels: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); useI18nStore.getState().setLanguage("id"); });

it("offers only a calibration bound to the selected model version and records the explicit selection", async () => {
  vi.mocked(listCarbonCalibrationModels).mockResolvedValue([{
    id: 7, model_id: "field-v1", model_name: "Field calibration", version: "1",
    target_pool: "aboveground_biomass_carbon", target_unit: "Mg C/ha", dataset_id: "site-1",
    application_scope: { site: "Local site", compatible_sensors: ["sentinel-2"], compatible_analysis_years: [2025] },
    baseline_model: { id: "base-model", version: "2", preprocessing_version: "s2-v1" },
    validation: { type: "independent_field_plot_holdout", validation_plot_count: 3 },
  }]);
  const onParamsChange = vi.fn();
  const selectedModel = {
    name: "base-model", version: "2", metadata_json: { target_pool: "aboveground_biomass_carbon", preprocessing_version: "s2-v1" },
  } as CarbonModelListItem;
  const params = { calibrationModelId: null, year: 2025 } as CarbonParams;
  render(<CarbonCalibrationPanel params={params} selectedModel={selectedModel} onParamsChange={onParamsChange} />);
  const select = await screen.findByLabelText("Versi kalibrasi");
  await waitFor(() => expect(select.querySelectorAll("option")).toHaveLength(2));
  fireEvent.change(select, { target: { value: "7" } });
  expect(onParamsChange).toHaveBeenCalledWith({ calibrationModelId: 7 });
  expect(screen.getByRole("note")).toHaveTextContent(/wilayah, dan tahun/);
});

it("hides calibrations outside their verified source year", async () => {
  vi.mocked(listCarbonCalibrationModels).mockResolvedValue([{
    id: 7, model_id: "field-v1", model_name: "Field calibration", version: "1",
    target_pool: "aboveground_biomass_carbon", target_unit: "Mg C/ha", dataset_id: "site-1",
    application_scope: { site: "Local site", compatible_sensors: ["sentinel-2"], compatible_analysis_years: [2025] },
    baseline_model: { id: "base-model", version: "2", preprocessing_version: "s2-v1" },
    validation: { type: "independent_field_plot_holdout", validation_plot_count: 3 },
  }]);
  const selectedModel = {
    name: "base-model", version: "2", metadata_json: { target_pool: "aboveground_biomass_carbon", preprocessing_version: "s2-v1" },
  } as CarbonModelListItem;
  render(<CarbonCalibrationPanel params={{ calibrationModelId: null, year: 2024 } as CarbonParams} selectedModel={selectedModel} onParamsChange={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/tahun analisis ini/));
});
