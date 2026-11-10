import { useState, type FormEvent } from "react";
import { fieldApi, type Pool } from "./carbonFieldApi";
import DetritusSampleFields from "./DetritusSampleFields";

export default function FieldObservationForm({
  datasetId,
  onSaved,
}: {
  datasetId: string;
  onSaved: () => void;
}) {
  const [pool, setPool] = useState<Pool>("agb");
  const [layerMode, setLayerMode] = useState(false);
  const [layers, setLayers] = useState([0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detritusMode, setDetritusMode] = useState("reported");
  const [quantity, setQuantity] = useState<"carbon" | "dry_biomass">("carbon");
  const derivedSample = (pool === "litter" || pool === "deadwood") && detritusMode === "sample";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const str = (name: string) => String(data.get(name) ?? "");
    const number = (name: string) => {
      const value = str(name);
      if (!value.trim() || !Number.isFinite(Number(value))) throw new Error(`Isi angka ${name}.`);
      return Number(value);
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const record: Record<string, unknown> = {
        plot_id: str("plot_id"),
        survey_date: str("survey_date"),
        pool,
        role: str("role"),
        latitude: number("latitude"),
        longitude: number("longitude"),
        plot_area_m2: number("area"),
        reference_type: pool === "soc" ? "laboratory" : str("reference_type"),
        method: str("method"),
        source: str("source"),
        quantity: derivedSample ? "dry_biomass" : pool === "soc" ? "carbon" : str("quantity"),
        unit: derivedSample ? "kg/plot" : str("unit"),
      };
      if (derivedSample || (str("quantity") === "dry_biomass" && pool !== "soc"))
        record.carbon_fraction = number("fraction");
      if (derivedSample && pool === "litter")
        record.litter_sample = {
          wet_mass_kg: number("litterWet"),
          subsample_wet_kg: number("litterSubWet"),
          subsample_dry_kg: number("litterSubDry"),
          quadrat_count: number("litterQuadrats"),
          quadrat_area_m2: number("litterQuadratArea"),
          maximum_diameter_cm: number("litterDiameter"),
        };
      if (derivedSample && pool === "deadwood")
        record.deadwood_sample = {
          minimum_diameter_cm: number("deadwoodDiameter"),
          pieces: data.getAll("deadwoodVolume").map((value, index) => ({
            volume_m3: Number(value),
            dry_density_kg_m3: Number(data.getAll("deadwoodDensity")[index]),
            component: String(data.getAll("deadwoodComponent")[index]),
            decay_class: String(data.getAll("deadwoodDecay")[index]),
            density_source: String(data.getAll("deadwoodDensitySource")[index]),
          })),
        };
      if (pool === "soc") {
        if (layerMode) record.unit = "Mg/ha";
        record.depth_top_cm = number("top");
        record.depth_bottom_cm = number("bottom");
        if (layerMode)
          record.soil_layers = layers.map((id) => ({
            top_cm: number(`top_${id}`),
            bottom_cm: number(`bottom_${id}`),
            organic_carbon_g_kg: number(`carbon_${id}`),
            bulk_density_g_cm3: number(`density_${id}`),
            coarse_fragments_volume_pct: number(`coarse_${id}`),
            bulk_density_basis: "fine_earth_per_fine_earth_volume",
          }));
      }
      if (!derivedSample && (pool !== "soc" || !layerMode)) record.value = number("value");
      await fieldApi.add(datasetId, record);
      onSaved();
      setNotice(
        `Pengukuran ${str("plot_id")} tersimpan. Ganti ID plot atau tanggal untuk pengukuran berikutnya.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pengukuran gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  const numeric = (name: string, label: string, min?: number, max?: number) => (
    <label className="col-md-4 form-label">
      {label}
      <input
        name={name}
        type="number"
        step="any"
        min={min}
        max={max}
        required
        className="form-control"
      />
    </label>
  );
  return (
    <details className="border rounded p-3 mb-3">
      <summary className="fw-semibold">Tambah pengukuran plot</summary>
      <form className="mt-3" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="row g-3">
            <label className="col-md-4 form-label">
              Pool
              <select
                value={pool}
                className="form-select"
                onChange={(e) => {
                  setPool(e.target.value as Pool);
                  setDetritusMode("reported");
                  setQuantity("carbon");
                  setError("");
                  setNotice("");
                }}
              >
                <option value="agb">AGB</option>
                <option value="bgb">BGB</option>
                <option value="soc">SOC</option>
                <option value="litter">Litter / serasah</option>
                <option value="deadwood">Deadwood / kayu mati</option>
              </select>
            </label>
            <label className="col-md-4 form-label">
              ID plot
              <input name="plot_id" className="form-control" maxLength={64} required />
            </label>
            <label className="col-md-4 form-label">
              Tanggal pengukuran
              <input
                name="survey_date"
                type="date"
                max={new Date().toLocaleDateString("en-CA")}
                className="form-control"
                required
              />
            </label>
            <label className="col-md-4 form-label">
              Peran plot
              <select name="role" className="form-select">
                <option value="calibration">Kalibrasi</option>
                <option value="validation">Validasi terpisah</option>
              </select>
            </label>
            {numeric("latitude", "Latitude (WGS84)", -90, 90)}
            {numeric("longitude", "Longitude (WGS84)", -180, 180)}
            {numeric("area", "Luas plot terukur (m²)", 0.0001)}
            {(pool === "litter" || pool === "deadwood") && (
              <label className="col-md-4 form-label">
                Cara input
                <select
                  className="form-select"
                  value={detritusMode}
                  onChange={(e) => setDetritusMode(e.target.value)}
                >
                  <option value="reported">Nilai stok / biomassa yang sudah dihitung</option>
                  <option value="sample">
                    {pool === "litter" ? "Sampel basah dan kering" : "Volume dan kerapatan kayu"}
                  </option>
                </select>
              </label>
            )}
            {pool !== "soc" && (
              <label className="col-md-4 form-label">
                Jenis referensi
                <select name="reference_type" className="form-select">
                  <option value="field_measurement">Pengukuran lapangan langsung</option>
                  <option value="laboratory">Pengukuran laboratorium</option>
                  <option value="allometry">Allometri terdokumentasi</option>
                  {pool === "bgb" && (
                    <option value="root_shoot_ratio">Turunan rasio akar:tajuk</option>
                  )}
                </select>
              </label>
            )}
            {!derivedSample && (
              <label className="col-md-4 form-label">
                Satuan hasil
                <select name="unit" className="form-select">
                  <option value="Mg/ha">Mg/ha</option>
                  <option value="kg/plot">kg/plot</option>
                </select>
              </label>
            )}
            {pool !== "soc" && (
              <>
                {!derivedSample && (
                  <label className="col-md-4 form-label">
                    Besaran
                    <select
                      name="quantity"
                      className="form-select"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(event.target.value as "carbon" | "dry_biomass")
                      }
                    >
                      <option value="carbon">Karbon</option>
                      <option value="dry_biomass">Biomassa kering</option>
                    </select>
                  </label>
                )}
                {(derivedSample || quantity === "dry_biomass") && (
                  <label className="col-md-4 form-label">
                    Fraksi karbon (wajib untuk biomassa)
                    <input
                      name="fraction"
                      type="number"
                      min={0.001}
                      max={0.999}
                      step="any"
                      required
                      className="form-control"
                    />
                  </label>
                )}
              </>
            )}
            {!derivedSample &&
              (pool !== "soc" || !layerMode) &&
              numeric("value", "Nilai hasil sesuai satuan", 0)}
            {derivedSample && (pool === "litter" || pool === "deadwood") && (
              <DetritusSampleFields key={pool} pool={pool} />
            )}
            <label className="col-md-6 form-label">
              Metode / persamaan / uji laboratorium
              <input
                name="method"
                className="form-control"
                minLength={3}
                maxLength={1000}
                required
              />
            </label>
            <label className="col-md-6 form-label">
              Sumber / laporan / kode hasil laboratorium
              <input
                name="source"
                className="form-control"
                minLength={3}
                maxLength={1000}
                required
              />
            </label>
            {pool === "soc" && (
              <>
                {numeric("top", "Kedalaman target atas (cm)", 0)}
                {numeric("bottom", "Kedalaman target bawah (cm)", 0.01, 1000)}
                <label className="col-md-4 form-label">
                  Input SOC
                  <select
                    className="form-select"
                    value={layerMode ? "layers" : "stock"}
                    onChange={(e) => setLayerMode(e.target.value === "layers")}
                  >
                    <option value="stock">Stok dari laporan laboratorium</option>
                    <option value="layers">Hitung dari lapisan tanah</option>
                  </select>
                </label>
                {layerMode && (
                  <div className="col-12">
                    <p className="small text-muted">
                      BD memakai massa tanah halus per volume tanah halus (tanpa fragmen kasar).
                      Fragmen kasar diisi sebagai persen volume. Lapisan harus berurutan dan
                      mencakup seluruh kedalaman target.
                    </p>
                    {layers.map((id, i) => (
                      <div className="border rounded p-2 mb-2" key={id}>
                        <strong>Lapisan {i + 1}</strong>
                        <div className="row g-2">
                          {numeric(`top_${id}`, "Atas (cm)", 0)}
                          {numeric(`bottom_${id}`, "Bawah (cm)", 0.01, 1000)}
                          {numeric(`carbon_${id}`, "C organik (g/kg)", 0, 1000)}
                          {numeric(`density_${id}`, "Bulk density (g/cm³)", 0.001, 3)}
                          {numeric(`coarse_${id}`, "Fragmen kasar (% volume)", 0, 99.99)}
                        </div>
                        {layers.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger mt-2"
                            onClick={() => setLayers(layers.filter((key) => key !== id))}
                          >
                            Hapus lapisan {i + 1}
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={layers.length >= 30}
                      onClick={() => setLayers([...layers, Math.max(...layers) + 1])}
                    >
                      Tambah lapisan
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="small text-muted mt-3">
            Pengukuran disimpan sebagai Mg C/ha. Tanggal baru menambah kunjungan; data lama tidak
            ditimpa. Plot validasi tidak boleh dipakai untuk kalibrasi pool yang sama.
          </p>
          <button className="btn btn-primary" type="submit">
            {busy ? "Menyimpan…" : "Simpan pengukuran"}
          </button>
        </fieldset>
        {notice && (
          <p role="status" className="text-success mt-2">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-danger mt-2">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
