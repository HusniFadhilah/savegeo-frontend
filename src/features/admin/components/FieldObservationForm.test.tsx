// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FieldObservationForm from "./FieldObservationForm";
import { fieldApi } from "./carbonFieldApi";
vi.mock("./carbonFieldApi", () => ({
  fieldApi: { add: vi.fn().mockResolvedValue({ created: 1 }) },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function common() {
  fill("ID plot", "P1");
  fill("Tanggal pengukuran", "2025-06-01");
  fill("Latitude (WGS84)", "-7");
  fill("Longitude (WGS84)", "110");
  fill("Luas plot terukur (m²)", "400");
  fill("Metode / persamaan / uji laboratorium", "Laboratory method 1");
  fill("Sumber / laporan / kode hasil laboratorium", "Survey 2025");
}
describe("field observations", () => {
  it("accepts litter composite samples with separate quadrat support", async () => {
    const saved = vi.fn();
    const { container } = render(<FieldObservationForm datasetId="test-site" onSaved={saved} />);
    fill("Pool", "litter");
    common();
    fill("Cara input", "sample");
    fill("Fraksi karbon (wajib untuk biomassa)", "0.37");
    fill("Berat basah komposit (kg)", "4");
    fill("Berat basah subsampel (kg)", "0.2");
    fill("Berat kering subsampel (kg)", "0.1");
    fill("Jumlah kuadrat", "4");
    fill("Luas setiap kuadrat (m²)", "0.25");
    fill("Batas diameter maksimum serasah (cm)", "10");
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(fieldApi.add).toHaveBeenCalledWith(
      "test-site",
      expect.objectContaining({
        pool: "litter",
        quantity: "dry_biomass",
        unit: "kg/plot",
        carbon_fraction: 0.37,
        litter_sample: expect.objectContaining({
          quadrat_count: 4,
          quadrat_area_m2: 0.25,
          wet_mass_kg: 4,
        }),
      }),
    );
    expect(vi.mocked(fieldApi.add).mock.calls[0]?.[1]).not.toHaveProperty("value");
  });
  it("keeps deadwood volume, density and decay class together", async () => {
    const saved = vi.fn();
    const { container } = render(<FieldObservationForm datasetId="test-site" onSaved={saved} />);
    fill("Pool", "deadwood");
    common();
    fill("Cara input", "sample");
    fill("Fraksi karbon (wajib untuk biomassa)", "0.47");
    fill("Batas diameter minimum kayu mati (cm)", "10");
    fill("Posisi kayu", "downed");
    fill("Volume (m³)", "1");
    fill("Kerapatan kering (kg/m³)", "300");
    fill("Kelas pelapukan", "II");
    fill("Sumber kerapatan (uji / literatur)", "Lab 2025");
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(fieldApi.add).toHaveBeenCalledWith(
      "test-site",
      expect.objectContaining({
        pool: "deadwood",
        quantity: "dry_biomass",
        deadwood_sample: {
          minimum_diameter_cm: 10,
          pieces: [
            expect.objectContaining({
              component: "downed",
              volume_m3: 1,
              dry_density_kg_m3: 300,
              decay_class: "II",
            }),
          ],
        },
      }),
    );
  });
  it("saves biomass with its explicit carbon fraction and unit instead of silently treating it as carbon", async () => {
    const saved = vi.fn();
    const { container } = render(<FieldObservationForm datasetId="test-site" onSaved={saved} />);
    common();
    fill("Besaran", "dry_biomass");
    fill("Fraksi karbon (wajib untuk biomassa)", "0.47");
    fill("Satuan hasil", "kg/plot");
    fill("Nilai hasil sesuai satuan", "1000");
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(fieldApi.add).toHaveBeenCalledWith(
      "test-site",
      expect.objectContaining({
        pool: "agb",
        quantity: "dry_biomass",
        unit: "kg/plot",
        value: 1000,
        carbon_fraction: 0.47,
        plot_area_m2: 400,
      }),
    );
  });
  it("submits complete SOC layers with explicit volume-based coarse fragments", async () => {
    const saved = vi.fn();
    const { container } = render(<FieldObservationForm datasetId="test-site" onSaved={saved} />);
    fill("Pool", "soc");
    common();
    fill("Input SOC", "layers");
    fill("Kedalaman target atas (cm)", "0");
    fill("Kedalaman target bawah (cm)", "30");
    fill("Atas (cm)", "0");
    fill("Bawah (cm)", "30");
    fill("C organik (g/kg)", "20");
    fill("Bulk density (g/cm³)", "1.2");
    fill("Fragmen kasar (% volume)", "10");
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(fieldApi.add).toHaveBeenCalledWith(
      "test-site",
      expect.objectContaining({
        pool: "soc",
        reference_type: "laboratory",
        depth_bottom_cm: 30,
        soil_layers: [
          expect.objectContaining({
            organic_carbon_g_kg: 20,
            bulk_density_g_cm3: 1.2,
            coarse_fragments_volume_pct: 10,
            bulk_density_basis: "fine_earth_per_fine_earth_volume",
          }),
        ],
      }),
    );
  });
});
