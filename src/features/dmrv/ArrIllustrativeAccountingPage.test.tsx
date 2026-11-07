import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import ArrIllustrativeAccountingPage from "./ArrIllustrativeAccountingPage";
import * as api from "./api";
import type { ArrIllustrativePreview } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, getArrIllustrativeExample: vi.fn() };
});
vi.mock("@/components/layout/DashboardShell", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

const example: ArrIllustrativePreview = {
  example_id: "arr_fixed_area_illustrative_v1",
  title: "ARR fixed-area accounting example (illustrative only)",
  source_type: "accounting_result",
  qualification: "illustrative_only",
  formula_id: "arr_fixed_area_illustrative_v1",
  methodology_profile: null,
  verification_status: "not_verified",
  issuance_status: "not_issued",
  rounding_policy: "Decimal precision 34, ROUND_HALF_EVEN; no additional output quantization",
  area_ha: "100",
  normalized_inputs: [
    { key: "area_ha", value: "100" },
    { key: "project_stock_start_mg_c_per_ha", value: "100" },
    { key: "project_stock_end_mg_c_per_ha", value: "120" },
    { key: "baseline_stock_start_mg_c_per_ha", value: "100" },
    { key: "baseline_stock_end_mg_c_per_ha", value: "105" },
    { key: "project_emissions_tco2e", value: null },
    { key: "leakage_tco2e", value: null },
  ],
  lines: [
    { key: "project_stock_change", value: "2000", unit: "Mg C", status: "computed", equation: "(project_stock_end - project_stock_start) * area_ha" },
    { key: "baseline_stock_change", value: "500", unit: "Mg C", status: "computed", equation: "(baseline_stock_end - baseline_stock_start) * area_ha" },
    { key: "additional_stock_change", value: "1500", unit: "Mg C", status: "computed", equation: "project_stock_change - baseline_stock_change" },
    { key: "gross_additional_removal", value: "5500", unit: "tCO2", status: "computed", equation: "additional_stock_change * 44 / 12" },
    { key: "project_emissions", value: null, unit: "tCO2e", status: "requires_data", equation: "project emissions under the selected accounting boundary" },
    { key: "leakage", value: null, unit: "tCO2e", status: "requires_data", equation: "leakage under the selected methodology" },
    { key: "net_mitigation", value: null, unit: "tCO2e", status: "requires_data", equation: "gross_additional_removal - project_emissions - leakage" },
  ],
  blockers: ["project_emissions_tco2e", "leakage_tco2e"],
};

beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
});
afterEach(cleanup);

describe("ArrIllustrativeAccountingPage", () => {
  it("shows the fixed ledger and leaves net mitigation unavailable", async () => {
    vi.mocked(api.getArrIllustrativeExample).mockResolvedValue(example);
    render(<MemoryRouter><ArrIllustrativeAccountingPage /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Contoh accounting ARR area tetap (ilustrasi)" })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("bukan data proyek");
    const grossRow = screen.getByRole("row", { name: /Serapan tambahan bruto/ });
    expect(within(grossRow).getByText("5500")).toBeInTheDocument();
    const netRow = screen.getByRole("row", { name: /Mitigasi neto/ });
    expect(within(netRow).getByText("Belum tersedia")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Mitigasi neto belum dihitung");
    expect(screen.getByText("Belum diverifikasi")).toBeInTheDocument();
  });
});
