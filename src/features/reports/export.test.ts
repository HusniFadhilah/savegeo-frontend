import { describe, expect, it, vi } from "vitest";
import { generatePdfReport, type ReportContext } from "./export";
import type { CarbonResult } from "@/features/carbon/types";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGPUqzViwAaYsIoOWgkAsfIA7QF4uu0AAAAASUVORK5CYII=";
function pool(name: string): CarbonResult { return { carbon_estimated: { tile_url: `https://example.test/${name}/{z}/{x}/{y}`, unit: "Mg C/ha", statistics: { mean: 10, min: 0, max: 20 }, vis_params: { min: 0, max: 20, palette: ["ffffcc", "006837"] } }, area_info: { total_carbon_tons: 100 }, model_info: { model_name: name, analysis_year: 2024 } }; }
const context: ReportContext = { aoi: { source: "coordinate", name: "DATA UJI", areaKm2: 1, bounds: null, feature: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[110,-7],[110.1,-7],[110.1,-6.9],[110,-6.9],[110,-7]]] } } }, analysisType: "carbon", year: 2024, startMonth: 1, endMonth: 12, cloudThreshold: 10, selectedIndices: [], processingTimes: {}, results: { carbonPools: { agb: pool("agb"), bgb: pool("bgb"), soc: pool("soc") }, carbonExtensions: { litter: pool("litter") } } };

describe("complete carbon PDF", () => {
  it("embeds a separate raster for every stock and extension pool", async () => {
    const renderer = vi.fn<(url: string, aoi: ReportContext["aoi"]) => Promise<string>>().mockResolvedValue(png);
    const bytes = await generatePdfReport(context, false, renderer);
    expect(renderer).toHaveBeenCalledTimes(4);
    expect(renderer.mock.calls.map((args) => args[0])).toEqual(expect.arrayContaining([
      expect.stringContaining("/agb/"), expect.stringContaining("/bgb/"), expect.stringContaining("/soc/"), expect.stringContaining("/litter/")
    ]));
    expect(new TextDecoder().decode(bytes).slice(0,4)).toBe("%PDF");
  });

  it("does not download a purportedly complete report when a raster is missing", async () => {
    const broken = { ...context, results: { carbon: { ...pool("agb"), carbon_estimated: { statistics: { mean: 10 } } } } };
    await expect(generatePdfReport(broken, false, async () => png)).rejects.toThrow("Peta raster");
  });
});
