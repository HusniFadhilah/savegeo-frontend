import { useState, type FormEvent } from "react";
import { createCarbonCalibrationDataset } from "../api";
import type { CarbonCalibrationDataset } from "../types";

export default function NewCalibrationDatasetForm({
  onCreated,
}: {
  onCreated: (dataset: CarbonCalibrationDataset) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const pools = data.getAll("pools");
      if (!pools.length) throw new Error("Pilih minimal satu pool.");
      const area = Number(data.get("area"));
      const plots = Number(data.get("plots"));
      const created = await createCarbonCalibrationDataset({
        dataset_id: data.get("id"),
        name: data.get("name"),
        site: data.get("site"),
        location: data.get("location"),
        survey_year: Number(data.get("year")),
        crs: "EPSG:4326",
        ecosystem: data.get("ecosystem"),
        species: [],
        sampling_design: data.get("sampling"),
        plot_count: plots,
        plot_size_m: [],
        sample_area_ha: (plots * area) / 10000,
        mapped_area_ha: Number(data.get("mappedArea")),
        target_pools: pools,
        carbon_fraction: Number(data.get("fraction")),
        field_reference_type: "pool_specific_field_observations",
        access: "restricted",
        status: "draft",
      });
      onCreated(created);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dataset gagal dibuat.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="admin-card mb-3">
      <summary className="fw-semibold p-3">Dataset lapangan baru · semua lokasi</summary>
      <form className="p-3 pt-0" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="row g-3">
            <label className="col-md-4 form-label">
              ID dataset
              <input
                name="id"
                className="form-control"
                required
                pattern="[a-z0-9][a-z0-9_-]{2,127}"
                placeholder="survei_semarang_2026"
              />
            </label>
            <label className="col-md-8 form-label">
              Nama dataset
              <input name="name" className="form-control" minLength={3} maxLength={255} required />
            </label>
            <label className="col-md-6 form-label">
              Tapak / proyek
              <input name="site" className="form-control" required />
            </label>
            <label className="col-md-6 form-label">
              Lokasi
              <input name="location" className="form-control" required />
            </label>
            <label className="col-md-4 form-label">
              Tahun survei
              <input
                name="year"
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                defaultValue={new Date().getFullYear()}
                className="form-control"
                required
              />
            </label>
            <label className="col-md-4 form-label">
              Ekosistem
              <input
                name="ecosystem"
                className="form-control"
                placeholder="Hutan, mangrove, agroforestri…"
                required
              />
            </label>
            <label className="col-md-4 form-label">
              Desain sampling
              <select name="sampling" className="form-select">
                <option value="systematic">Sistematis</option>
                <option value="stratified_random">Acak berstrata</option>
                <option value="random">Acak</option>
                <option value="purposive">Purposif</option>
              </select>
            </label>
            <label className="col-md-3 form-label">
              Jumlah plot
              <input
                name="plots"
                type="number"
                min={1}
                step={1}
                className="form-control"
                required
              />
            </label>
            <label className="col-md-3 form-label">
              Luas plot rencana (m²)
              <input
                name="area"
                type="number"
                min={0.01}
                step="any"
                className="form-control"
                required
              />
            </label>
            <label className="col-md-3 form-label">
              Luas tapak (ha)
              <input
                name="mappedArea"
                type="number"
                min={0.0001}
                step="any"
                className="form-control"
                required
              />
            </label>
            <label className="col-md-3 form-label">
              Fraksi C biomassa dataset
              <input
                name="fraction"
                type="number"
                min={0.001}
                max={0.999}
                step="any"
                className="form-control"
                required
              />
              <small className="text-muted">
                Nyatakan sesuai metode. Setiap pengukuran menyimpan fraksi aktualnya sendiri.
              </small>
            </label>
            <div className="col-12">
              <span className="d-block mb-2">Pool pengukuran</span>
              {[
                ["aboveground_biomass_carbon", "AGB"],
                ["belowground_biomass_carbon", "BGB"],
                ["soil_organic_carbon", "SOC"],
                ["litter_carbon", "Litter / serasah"],
                ["deadwood_carbon", "Deadwood / kayu mati"],
              ].map(([value, label]) => (
                <label key={value} className="form-check form-check-inline">
                  <input className="form-check-input" name="pools" type="checkbox" value={value} />
                  <span className="form-check-label">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary mt-3" type="submit">
            {busy ? "Menyimpan…" : "Buat dataset"}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="text-danger mt-2">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
