import { useState, type FormEvent } from "react";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";
import { createCarbonCalibrationDataset } from "../api";
import type { CarbonCalibrationDataset } from "../types";

export default function NewCalibrationDatasetForm({
  onCreated,
}: {
  onCreated: (dataset: CarbonCalibrationDataset) => void;
}) {
  const c = useBilingualCopy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const pools = data.getAll("pools");
      if (!pools.length) throw new Error(c("Pilih minimal satu pool.", "Select at least one carbon pool."));
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
      setError(reason instanceof Error ? reason.message : c("Dataset gagal dibuat.", "Could not create the dataset."));
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
          <strong>{c("Dataset lapangan baru", "New field dataset")}</strong>
          <small>{c("Daftarkan dataset kalibrasi untuk semua lokasi", "Register a calibration dataset for all locations")}</small>
        </span>
        <span className="calibration-new-dataset__scope">{c("Semua lokasi", "All locations")}</span>
      </summary>
      <form className="calibration-new-dataset__form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="calibration-new-dataset__fields">
            <label className="calibration-new-dataset__field span-4">
              <span>{c("ID dataset", "Dataset ID")}</span>
              <input
                name="id"
                className="form-control"
                required
                pattern="[a-z0-9][a-z0-9_-]{2,127}"
                placeholder={c("survei_semarang_2026", "semarang_survey_2026")}
              />
            </label>
            <label className="calibration-new-dataset__field span-8">
              <span>{c("Nama dataset", "Dataset name")}</span>
              <input name="name" className="form-control" minLength={3} maxLength={255} required />
            </label>
            <label className="calibration-new-dataset__field span-6">
              <span>{c("Tapak / proyek", "Site / project")}</span>
              <input name="site" className="form-control" required />
            </label>
            <label className="calibration-new-dataset__field span-6">
              <span>{c("Lokasi", "Location")}</span>
              <input name="location" className="form-control" required />
            </label>
            <label className="calibration-new-dataset__field span-4">
              <span>{c("Tahun survei", "Survey year")}</span>
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
              <span>{c("Ekosistem", "Ecosystem")}</span>
              <input
                name="ecosystem"
                className="form-control"
                placeholder={c("Hutan, mangrove, agroforestri…", "Forest, mangrove, agroforestry…")}
                required
              />
            </label>
            <label className="calibration-new-dataset__field span-4">
              <span>{c("Desain sampling", "Sampling design")}</span>
              <select name="sampling" className="form-select">
                <option value="systematic">{c("Sistematis", "Systematic")}</option>
                <option value="stratified_random">{c("Acak berstrata", "Stratified random")}</option>
                <option value="random">{c("Acak", "Random")}</option>
                <option value="purposive">{c("Purposif", "Purposive")}</option>
              </select>
            </label>
            <label className="calibration-new-dataset__field span-3">
              <span>{c("Jumlah plot", "Number of plots")}</span>
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
              <span>{c("Luas plot rencana (m²)", "Planned plot area (m²)")}</span>
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
              <span>{c("Luas tapak (ha)", "Site area (ha)")}</span>
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
              <span>{c("Fraksi C biomassa dataset", "Dataset biomass carbon fraction")}</span>
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
                {c("Nyatakan sesuai metode. Setiap pengukuran menyimpan fraksi aktualnya sendiri.", "Enter the value required by the method. Each measurement stores its own actual fraction.")}
              </small>
            </label>
            <div className="calibration-new-dataset__pool-section">
              <div className="calibration-new-dataset__pool-heading">
                <strong>{c("Pool pengukuran", "Measured pools")}</strong>
                <small>{c("Pilih satu atau beberapa pool yang tersedia dalam survei.", "Select one or more pools measured in the survey.")}</small>
              </div>
              <div className="calibration-new-dataset__pool-options">
                {[
                  ["aboveground_biomass_carbon", "AGB"],
                  ["belowground_biomass_carbon", "BGB"],
                  ["soil_organic_carbon", "SOC"],
                  ["litter_carbon", c("Serasah", "Litter")],
                  ["deadwood_carbon", c("Kayu mati", "Deadwood")],
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
            <span>{c("Dataset baru dibuat sebagai draft privat.", "New datasets are created as private drafts.")}</span>
            <button className="btn btn-primary" type="submit">
              <i className={`bi ${busy ? "bi-arrow-repeat" : "bi-plus-lg"}`} aria-hidden="true" />
              {busy ? c("Menyimpan…", "Saving…") : c("Buat dataset", "Create dataset")}
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
