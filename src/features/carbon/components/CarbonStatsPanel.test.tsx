import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { CarbonResult } from "../types";
import CarbonStatsPanel from "./CarbonStatsPanel";

vi.mock("react-chartjs-2", () => ({
  Bar: ({ data }: { data: unknown }) => <div data-testid="density-bars">{JSON.stringify(data)}</div>,
  Line: ({ data }: { data: unknown }) => <div data-testid="density-cumulative">{JSON.stringify(data)}</div>,
}));

afterEach(cleanup);
beforeEach(() => useI18nStore.getState().setLanguage("id"));

const result: CarbonResult = {
  carbon_estimated: { unit: "Mg C/ha", statistics: { mean: 12.5, std_dev: 2, min: 0, max: 25 } },
  area_info: { calculation_area_ha: 100, total_carbon_tons: 1250 },
  model_info: { target_pool: "belowground_biomass_carbon", statistics_available: true },
};

describe("carbon pool density statistics", () => {
  it("keeps numeric statistics visible for stored results without a histogram", () => {
    const { container } = render(<CarbonStatsPanel result={result} />);
    expect(container.querySelector(".cs-chart-summary")).toHaveTextContent(/12[,.]50/);
    expect(screen.queryByTestId("density-bars")).not.toBeInTheDocument();
  });

  it("renders histogram and cumulative charts from the supplied BGB/SOC pixel counts", () => {
    render(<CarbonStatsPanel result={{ ...result, carbon_estimated: { ...result.carbon_estimated,
      statistics: { ...result.carbon_estimated.statistics, percentiles: { p25: 5, median: 10, p75: 15 },
        histogram: { bucket_means: [0, 10, 20], counts: [2, 6, 2], pixel_count: 10, sampled: true, scale_m: 1000 } } } }} />);
    expect(screen.getByTestId("density-bars")).toHaveTextContent('"data":[2,6,2]');
    expect(screen.getByTestId("density-cumulative")).toHaveTextContent('"data":[20,80,100]');
    expect(screen.getByText("1.000 m")).toBeInTheDocument();
  });
});
