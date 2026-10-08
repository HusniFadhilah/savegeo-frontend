import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CarbonModule from "./CarbonModule";
import { useAoiStore } from "@/hooks/useAoiStore";
import { useConfigStore } from "@/hooks/useConfigStore";
import { executeUiCommand, readUiCommandState } from "@/features/chatbot/uiCommandBus";
import { analyzeVegetation } from "@/features/vegetation/api";
import { ApiError } from "@/services/apiClient";

vi.mock("@/features/vegetation/api", () => ({ analyzeVegetation: vi.fn(), analyzeVegetationTimeSeries: vi.fn(), getVegetationSatellites: vi.fn(), getVegetationCatalog: vi.fn().mockResolvedValue({ indices: { NDVI: {}, NDWI: {}, MNDWI: {}, NDBI: {} } }) }));
vi.mock("@/features/carbon/api", () => ({ analyzeCarbon: vi.fn(), analyzeCarbonDelta: vi.fn(), listCarbonDatasets: vi.fn(), listCarbonModels: vi.fn(), loadDirectCarbonReferenceLayer: vi.fn(), loadDirectLandCoverReferenceLayer: vi.fn() }));
vi.mock("@/features/landcover/api", () => ({ analyzeLandCover: vi.fn(), fetchLandCoverDatasets: vi.fn() }));
vi.mock("./components/AoiPanel", () => ({ default: () => null }));
vi.mock("./components/AnalysisTypeSelector", () => ({ default: () => null }));
vi.mock("./components/CarbonParamsPanel", () => ({ default: () => null }));
vi.mock("./components/ResultsMapPanel", () => ({ default: () => null }));
vi.mock("./components/StatsCards", () => ({ default: () => null }));
vi.mock("./components/CarbonStatsPanel", () => ({ default: () => null }));
vi.mock("./components/ExportPanel", () => ({ default: () => null }));
vi.mock("./components/CarbonTimeSeriesPanel", () => ({ default: () => null }));
vi.mock("@/components/ui/InfoTip", () => ({ default: () => null }));
vi.mock("@/features/vegetation/components/VegetationParamsPanel", () => ({ default: () => null }));
vi.mock("@/features/vegetation/components/VegStatsTable", () => ({ default: () => null }));
vi.mock("@/features/vegetation/components/VegetationTimeSeriesPanel", () => ({ default: () => null }));
vi.mock("@/features/landcover/components/LandCoverParamsPanel", () => ({ default: () => null }));
vi.mock("@/features/landcover/components/LandCoverResultTables", () => ({ default: () => null }));

async function command(action: string, target: string, value?: unknown) {
  await act(async () => {
    await executeUiCommand({ action, target, parameters: value === undefined ? {} : { value } });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useConfigStore.setState({ ready: true });
  useAoiStore.getState().setAoi({
    source: "admin", name: "BALI", areaKm2: 1, bounds: null,
    feature: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[115, -8], [115.01, -8], [115.01, -8.01], [115, -8.01], [115, -8]]] } },
  });
});
afterEach(() => { cleanup(); useAoiStore.getState().setAoi(null); });

describe("chatbot vegetation execution in the actual owning module", () => {
  it("leaves carbon direct/reference modes and runs vegetation with its own parameters", async () => {
    const vegetationResult = { indices: { NDVI: { mean: 0.6 } } };
    vi.mocked(analyzeVegetation).mockResolvedValue(vegetationResult);
    render(<CarbonModule />);
    await command("set_parameter", "carbon.loadOnly", true);
    expect(readUiCommandState("carbon")).toMatchObject({ loadOnly: true, referenceOnly: true });
    await command("set_parameter", "carbon.directGlobal", true);
    expect(readUiCommandState("carbon")?.directGlobal).toBe(true);
    await command("set_analysis_type", "carbon.analysisType", "vegetation");
    expect(readUiCommandState("carbon")).toMatchObject({ analysisType: "vegetation", directGlobal: false, loadOnly: false, referenceOnly: false });
    await command("set_parameter", "carbon.vegetationStartMonth", 2);
    await command("set_parameter", "carbon.vegetationEndMonth", 8);
    await command("set_parameter", "carbon.vegetationCloudThreshold", 35);
    await command("run_analysis", "carbon.analysis");
    expect(analyzeVegetation).toHaveBeenCalledWith(expect.anything(), expect.any(Number), expect.objectContaining({ startMonth: 2, endMonth: 8, cloudThreshold: 35, satellite: "sentinel2" }));
    expect(readUiCommandState("carbon")).toMatchObject({ hasResult: true, error: null });
  });

  it("applies shared month/cloud commands to vegetation rather than carbon-only state", async () => {
    vi.mocked(analyzeVegetation).mockResolvedValue({ indices: { NDVI: { mean: 0.5 } } });
    render(<CarbonModule />);
    await command("set_analysis_type", "carbon.analysisType", "vegetation");
    await command("set_parameter", "carbon.startMonth", 3);
    await command("set_parameter", "carbon.endMonth", 7);
    await command("set_parameter", "carbon.cloudThreshold", 20);
    expect(readUiCommandState("carbon")).toMatchObject({ vegetationStartMonth: 3, vegetationEndMonth: 7, vegetationCloudThreshold: 20 });
    await command("run_analysis", "carbon.analysis");
    expect(analyzeVegetation).toHaveBeenCalledWith(expect.anything(), expect.any(Number), expect.objectContaining({ startMonth: 3, endMonth: 7, cloudThreshold: 20 }));
  });

  it("reports vegetation backend failure and does not claim a result", async () => {
    vi.mocked(analyzeVegetation).mockRejectedValue(new ApiError("No valid vegetation pixels in AOI", 400));
    render(<CarbonModule />);
    await command("set_analysis_type", "carbon.analysisType", "vegetation");
    await expect(command("run_analysis", "carbon.analysis")).rejects.toThrow("No valid vegetation pixels in AOI");
    expect(readUiCommandState("carbon")?.hasResult).toBe(false);
  });
});
