import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/hooks/useI18nStore";
import FieldDataPanel from "./FieldDataPanel";
import * as api from "./api";
import type { ImportPreview, ImportResult, Plot, Visit } from "./types";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    listPlots: vi.fn(), listVisits: vi.fn(), previewFieldImport: vi.fn(), commitFieldImport: vi.fn(),
    newIdempotencyKey: vi.fn(() => "key-1"),
  };
});

const preview = (over: Partial<ImportPreview["report"]> = {}): ImportPreview => ({
  headers: ["plot_code", "dbh_cm"],
  suggested_mapping: { plot_code: "plot_code", dbh_cm: "dbh_cm" },
  sample: [{ plot_code: "1", dbh_cm: "22.28" }],
  report: {
    rows_total: 3, errors: 1, warnings: 0,
    issues: [{ row: 4, level: "error", code: "bad_number", message: "Kolom dbh_cm bukan angka: 'abc'." }],
    ...over,
  },
});
const result = (over: Partial<ImportResult> = {}): ImportResult => ({
  batch_id: "b-1", status: "rejected", mode: "atomic", rows_total: 3, rows_imported: 0, rows_rejected: 1,
  plots_created: 0, visits_created: 0, issues: [], ...over,
});
const plot = (over: Partial<Plot> = {}): Plot => ({
  plot_code: "1", latitude: -7.05, longitude: 110.43, area_m2: 400, area_basis: "assumed", visit_count: 1, ...over,
});
const visit = (over: Partial<Visit["density"]> = {}): Visit => ({
  visit_date: "2024-01-01", date_precision: "year", tree_count: 21,
  density: {
    source_type: "field_measurement", biomass_dry_mg_per_ha: 8.58, carbon_mg_c_per_ha: 4.0326, area_m2: 400,
    area_basis: "assumed", carbon_fraction: 0.47, trees_without_biomass: 0, blockers: [], ...over,
  },
});

const csv = () => new File(["plot_code,dbh_cm\n1,22.28\n"], "trees.csv", { type: "text/csv" });
function choose(file = csv()) {
  fireEvent.change(screen.getByLabelText("Berkas CSV atau XLSX"), { target: { files: [file] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  useI18nStore.getState().setLanguage("id");
  vi.mocked(api.listPlots).mockResolvedValue([]);
});
afterEach(cleanup);

describe("FieldDataPanel", () => {
  it("shows an empty state and keeps import locked until a preview exists", async () => {
    render(<FieldDataPanel projectId="p-1" canWrite />);
    expect(await screen.findByText(/Belum ada data lapangan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pratinjau" })).toBeDisabled();
    choose();
    expect(screen.getByRole("button", { name: "Impor" })).toBeDisabled();
    expect(screen.getByText("Pratinjau berkas lebih dulu sebelum mengimpor.")).toBeInTheDocument();
  });

  it("lists row issues with row numbers after a preview", async () => {
    vi.mocked(api.previewFieldImport).mockResolvedValue(preview());
    render(<FieldDataPanel projectId="p-1" canWrite />);
    await screen.findByText(/Belum ada data lapangan/);
    choose();
    fireEvent.click(screen.getByRole("button", { name: "Pratinjau" }));
    expect(await screen.findByText("3 baris, 1 galat, 0 peringatan")).toBeInTheDocument();
    const issues = within(screen.getByRole("table", { name: "Masalah per baris" }));
    expect(issues.getByText("4")).toBeInTheDocument();
    expect(issues.getByText("bad_number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Impor" })).toBeEnabled();
  });

  it("does not offer import for a file with no data rows", async () => {
    vi.mocked(api.previewFieldImport).mockResolvedValue(preview({ rows_total: 0, errors: 0, issues: [] }));
    render(<FieldDataPanel projectId="p-1" canWrite />);
    await screen.findByText(/Belum ada data lapangan/);
    choose();
    fireEvent.click(screen.getByRole("button", { name: "Pratinjau" }));
    await screen.findByText("0 baris, 0 galat, 0 peringatan");
    expect(screen.getByRole("button", { name: "Impor" })).toBeDisabled();
  });

  it("sends the form fields and one idempotency key, then reports the outcome and refreshes plots", async () => {
    vi.mocked(api.previewFieldImport).mockResolvedValue(preview());
    vi.mocked(api.commitFieldImport).mockResolvedValue(result());
    render(<FieldDataPanel projectId="p-1" canWrite />);
    await screen.findByText(/Belum ada data lapangan/);
    choose();
    fireEvent.change(screen.getByLabelText("Satuan kolom tinggi"), { target: { value: "cm" } });
    fireEvent.change(screen.getByLabelText("Luas plot (m²)"), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Pratinjau" }));
    await screen.findByText("3 baris, 1 galat, 0 peringatan");
    const importButton = screen.getByRole("button", { name: "Impor" });
    fireEvent.click(importButton);
    fireEvent.click(importButton);
    await waitFor(() => expect(api.commitFieldImport).toHaveBeenCalledTimes(1));
    const [projectId, form, key] = vi.mocked(api.commitFieldImport).mock.calls[0];
    expect(projectId).toBe("p-1");
    expect(key).toBe("key-1");
    expect(form.get("mode")).toBe("atomic");
    expect(form.get("height_unit")).toBe("cm");
    expect(form.get("plot_area_m2")).toBe("400");
    expect(form.get("area_basis")).toBe("assumed");
    expect((form.get("file") as File).name).toBe("trees.csv");
    expect(await screen.findByRole("status")).toHaveTextContent("Hasil impor: rejected; 0 baris diimpor, 1 ditolak.");
    await waitFor(() => expect(api.listPlots).toHaveBeenCalledTimes(2));
  });

  it("shows density with unit and area basis, or the blocker when the area is unknown", async () => {
    vi.mocked(api.listPlots).mockResolvedValue([plot(), plot({ plot_code: "2", area_m2: null, area_basis: null })]);
    vi.mocked(api.listVisits)
      .mockResolvedValueOnce([visit()])
      .mockResolvedValueOnce([visit({ carbon_mg_c_per_ha: null, biomass_dry_mg_per_ha: null, area_m2: null, area_basis: null, blockers: ["plot_area_unknown"] })]);
    render(<FieldDataPanel projectId="p-1" canWrite />);
    const buttons = await screen.findAllByRole("button", { name: "Lihat kunjungan" });
    fireEvent.click(buttons[0]);
    expect(await screen.findByText("4,03 Mg C/ha")).toBeInTheDocument();
    expect(screen.getByText("dasar luas: Asumsi")).toBeInTheDocument();
    expect(screen.getByText("2024 (hanya tahun)")).toBeInTheDocument();
    fireEvent.click(buttons[1]);
    expect(await screen.findByText("Luas plot belum diketahui; kerapatan tidak dihitung.")).toBeInTheDocument();
  });

  it("is read-only for roles without field.write but still lists plots", async () => {
    vi.mocked(api.listPlots).mockResolvedValue([plot()]);
    render(<FieldDataPanel projectId="p-1" canWrite={false} />);
    expect(await screen.findByText("Peran Anda hanya dapat melihat data lapangan.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Berkas CSV atau XLSX")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lihat kunjungan" })).toBeInTheDocument();
  });
});
