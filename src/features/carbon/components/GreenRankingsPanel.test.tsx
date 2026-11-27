import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GreenRankingsPanel from "./GreenRankingsPanel";
import * as regions from "@/services/analysisService";
import { runAnalysisJob } from "@/services/analysisJobs";
import type { GreenRankingResult } from "../extendedTypes";
import { useI18nStore } from "@/hooks/useI18nStore";

vi.mock("@/services/analysisService", () => ({ fetchProvinces: vi.fn(), fetchCities: vi.fn(), fetchDistricts: vi.fn() }));
vi.mock("@/services/analysisJobs", () => ({ runAnalysisJob: vi.fn() }));
vi.mock("@/components/ui/SearchableSelect", () => ({ default: ({ id, value, options, onChange, disabled }: { id: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled: boolean }) => <select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }));
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); useI18nStore.getState().setLanguage("id"); vi.mocked(regions.fetchProvinces).mockResolvedValue([{ code: "33", name: "Jawa Tengah" }]); vi.mocked(regions.fetchCities).mockResolvedValue([{ code: "3374", name: "Kota Semarang" }]); vi.mocked(regions.fetchDistricts).mockResolvedValue([{ code: "337401", name: "Kecamatan test" }]); });
afterEach(cleanup);

it("filters village rankings by province, city and district, and continues a durable run", async () => {
  const result: GreenRankingResult = { run_id: "run-test", cursor: "cursor-1", done: false, status: "partial", config: { level: "village", year: 2024, start_month: 1, end_month: 12, scale: 10 }, page: 1, page_size: 50, rows: [], statistics: { processed: 0, eligible: 0, area_ha: 0, valid_area_ha: 0, green_area_ha: 0, mean_percent: null, min_percent: null, max_percent: null, area_weighted_green_percent: null }, method: "method", boundary_source: "source", source_url: "https://example.test" };
  vi.mocked(runAnalysisJob).mockResolvedValueOnce(result).mockResolvedValueOnce({ ...result, done: true, status: "complete", cursor: "cursor-2" });
  render(<GreenRankingsPanel year={2024} startMonth={1} endMonth={12} onResult={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Tingkat peringkat"), { target: { value: "village" } });
  await screen.findByRole("option", { name: "Jawa Tengah" });
  fireEvent.change(screen.getByLabelText("Provinsi"), { target: { value: "33" } });
  await screen.findByRole("option", { name: "Kota Semarang" });
  fireEvent.change(screen.getByLabelText("Kabupaten/kota"), { target: { value: "3374" } });
  await screen.findByRole("option", { name: "Kecamatan test" });
  fireEvent.change(screen.getByLabelText("Kecamatan"), { target: { value: "337401" } });
  fireEvent.click(screen.getByRole("button", { name: "Hitung peringkat" }));
  await waitFor(() => expect(runAnalysisJob).toHaveBeenCalledTimes(2));
  expect(vi.mocked(runAnalysisJob).mock.calls[1][1]).toMatchObject({ extension_settings: { level: "village", province: "33", city: "3374", district: "337401", run_id: "run-test", cursor: "cursor-1" } });
  expect(await screen.findByText(/Penelusuran wilayah selesai/)).toBeInTheDocument();
});
