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
    <details className="admin-card calibration-surface-card calibration-new-dataset mb-3">
      <summary className="calibration-new-dataset__summary">
        <span className="calibration-new-dataset__icon" aria-hidden="true">
          <i className="bi bi-database-add" />
        </span>
        <span className="calibration-new-dataset__title">
          <strong>Dataset lapangan baru</strong>
          <small>Daftarkan dataset kalibrasi untuk semua lokasi</small>
        </span>
        <span className="calibration-new-dataset__scope">Semua lokasi</span>
      </summary>
      <form className="calibration-new-dataset__form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="calibration-new-dataset__fields">
            <label className="calibration-new-dataset__field span-4">
              <span>ID dataset</span>
              <input
                name="id"
                className="form-control"
                required
                pattern="[a-z0-9][a-z0-9_-]{2,127}"
                placeholder="survei_semarang_2026"
              />
            </label>
            <label className="calibration-new-dataset__field span-8">
              <span>Nama dataset</span>
              <input name="name" className="form-control" minLength={3} maxLength={255} required />
            </label>
            <label className="calibration-new-dataset__field span-6">
              <span>Tapak / proyek</span>
              <input name="site" className="form-control" required />
            </label>
            <label className="calibration-new-dataset__field span-6">
              <span>Lokasi</span>
              <input name="location" className="form-control" required />
            </label>
            <label className="calibration-new-dataset__field span-4">
              <span>Tahun survei</span>
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
            <label className="calibration-new-dataset__field span-4">
              <span>Ekosistem</span>
              <input
                name="ecosystem"
                className="form-control"
                placeholder="Hutan, mangrove, agroforestri…"
                required
              />
            </label>
            <label className="calibration-new-dataset__field span-4">
              <span>Desain sampling</span>
              <select name="sampling" className="form-select">
                <option value="systematic">Sistematis</option>
                <option value="stratified_random">Acak berstrata</option>
                <option value="random">Acak</option>
                <option value="purposive">Purposif</option>
              </select>
            </label>
            <label className="calibration-new-dataset__field span-3">
              <span>Jumlah plot</span>
              <input
                name="plots"
                type="number"
                min={1}
                step={1}
                className="form-control"
                required
              />
            </label>
            <label className="calibration-new-dataset__field span-3">
              <span>Luas plot rencana (m²)</span>
              <input
                name="area"
                type="number"
                min={0.01}
                step="any"
                className="form-control"
                required
              />
            </label>
            <label className="calibration-new-dataset__field span-3">
              <span>Luas tapak (ha)</span>
              <input
                name="mappedArea"
                type="number"
                min={0.0001}
                step="any"
                className="form-control"
                required
              />
            </label>
            <label className="calibration-new-dataset__field span-3">
              <span>Fraksi C biomassa dataset</span>
              <input
                name="fraction"
                type="number"
                min={0.001}
                max={0.999}
                step="any"
                className="form-control"
                required
              />
              <small>
                Nyatakan sesuai metode. Setiap pengukuran menyimpan fraksi aktualnya sendiri.
              </small>
            </label>
            <div className="calibration-new-dataset__pool-section">
              <div className="calibration-new-dataset__pool-heading">
                <strong>Pool pengukuran</strong>
                <small>Pilih satu atau beberapa pool yang tersedia dalam survei.</small>
              </div>
              <div className="calibration-new-dataset__pool-options">
                {[
                  ["aboveground_biomass_carbon", "AGB"],
                  ["belowground_biomass_carbon", "BGB"],
                  ["soil_organic_carbon", "SOC"],
                  ["litter_carbon", "Litter / serasah"],
                  ["deadwood_carbon", "Deadwood / kayu mati"],
                ].map(([value, label]) => (
                  <label key={value} className="calibration-new-dataset__pool-chip">
                    <input className="form-check-input" name="pools" type="checkbox" value={value} />
                    <span className="form-check-label">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="calibration-new-dataset__actions">
            <span>Dataset baru dibuat sebagai draft privat.</span>
            <button className="btn btn-primary" type="submit">
              <i className={`bi ${busy ? "bi-arrow-repeat" : "bi-plus-lg"}`} aria-hidden="true" />
              {busy ? "Menyimpan…" : "Buat dataset"}
            </button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="calibration-new-dataset__error">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
