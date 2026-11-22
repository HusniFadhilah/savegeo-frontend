import { useState, type FormEvent } from "react";
import { fieldApi, type Pool } from "./carbonFieldApi";
import DetritusSampleFields from "./DetritusSampleFields";
import { useI18nStore } from "@/hooks/useI18nStore";

export default function FieldObservationForm({
  datasetId,
  onSaved,
}: {
  datasetId: string;
  onSaved: () => void;
}) {
  const t = useI18nStore((state) => state.t);
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
      if (!value.trim() || !Number.isFinite(Number(value)))
        throw new Error(t("admin.fieldObservation.numericRequired", {
          field: t(`admin.fieldObservation.field.${name.replace(/_\d+$/, "")}`),
        }));
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
      setNotice(t("admin.fieldObservation.saved", { plot: str("plot_id") }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("admin.fieldObservation.saveFailed"));
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
    <details className="field-panel-accordion">
      <summary className="fw-semibold">{t("admin.fieldObservation.addTitle")}</summary>
      <form className="mt-3" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="row g-3">
            <label className="col-md-4 form-label">
              {t("admin.fieldObservation.pool")}
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
                <option value="litter">{t("admin.fieldCalibration.pool.litter")}</option>
                <option value="deadwood">{t("admin.fieldCalibration.pool.deadwood")}</option>
              </select>
            </label>
            <label className="col-md-4 form-label">
              {t("admin.fieldObservation.plotId")}
              <input name="plot_id" className="form-control" maxLength={64} required />
            </label>
            <label className="col-md-4 form-label">
              {t("admin.fieldObservation.surveyDate")}
              <input
                name="survey_date"
                type="date"
                max={new Date().toLocaleDateString("en-CA")}
                className="form-control"
                required
              />
            </label>
            <label className="col-md-4 form-label">
              {t("admin.fieldObservation.plotRole")}
              <select name="role" className="form-select">
                <option value="calibration">{t("admin.fieldObservation.calibration")}</option>
                <option value="validation">{t("admin.fieldObservation.independentValidation")}</option>
              </select>
            </label>
            {numeric("latitude", t("admin.fieldObservation.latitude"), -90, 90)}
            {numeric("longitude", t("admin.fieldObservation.longitude"), -180, 180)}
            {numeric("area", t("admin.fieldObservation.measuredPlotArea"), 0.0001)}
            {(pool === "litter" || pool === "deadwood") && (
              <label className="col-md-4 form-label">
                {t("admin.fieldObservation.inputMethod")}
                <select
                  className="form-select"
                  value={detritusMode}
                  onChange={(e) => setDetritusMode(e.target.value)}
                >
                  <option value="reported">{t("admin.fieldObservation.reportedValue")}</option>
                  <option value="sample">
                    {pool === "litter" ? t("admin.fieldObservation.wetDrySample") : t("admin.fieldObservation.volumeDensitySample")}
                  </option>
                </select>
              </label>
            )}
            {pool !== "soc" && (
              <label className="col-md-4 form-label">
                {t("admin.fieldObservation.referenceType")}
                <select name="reference_type" className="form-select">
                  <option value="field_measurement">{t("admin.fieldObservation.reference.field")}</option>
                  <option value="laboratory">{t("admin.fieldObservation.reference.lab")}</option>
                  <option value="allometry">{t("admin.fieldObservation.reference.allometry")}</option>
                  {pool === "bgb" && (
                    <option value="root_shoot_ratio">{t("admin.fieldObservation.reference.rootShoot")}</option>
                  )}
                </select>
              </label>
            )}
            {!derivedSample && (
              <label className="col-md-4 form-label">
                {t("admin.fieldObservation.resultUnit")}
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
                    {t("admin.fieldObservation.quantity")}
                    <select
                      name="quantity"
                      className="form-select"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(event.target.value as "carbon" | "dry_biomass")
                      }
                    >
                      <option value="carbon">{t("admin.fieldObservation.carbon")}</option>
                      <option value="dry_biomass">{t("admin.fieldObservation.dryBiomass")}</option>
                    </select>
                  </label>
                )}
                {(derivedSample || quantity === "dry_biomass") && (
                  <label className="col-md-4 form-label">
                    {t("admin.fieldObservation.carbonFraction")}
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
              numeric("value", t("admin.fieldObservation.resultValue"), 0)}
            {derivedSample && (pool === "litter" || pool === "deadwood") && (
              <DetritusSampleFields key={pool} pool={pool} />
            )}
            <label className="col-md-6 form-label">
              {t("admin.fieldObservation.method")}
              <input
                name="method"
                className="form-control"
                minLength={3}
                maxLength={1000}
                required
              />
            </label>
            <label className="col-md-6 form-label">
              {t("admin.fieldObservation.source")}
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
                {numeric("top", t("admin.fieldObservation.targetDepthTop"), 0)}
                {numeric("bottom", t("admin.fieldObservation.targetDepthBottom"), 0.01, 1000)}
                <label className="col-md-4 form-label">
                  {t("admin.fieldObservation.socInput")}
                  <select
                    className="form-select"
                    value={layerMode ? "layers" : "stock"}
                    onChange={(e) => setLayerMode(e.target.value === "layers")}
                  >
                    <option value="stock">{t("admin.fieldObservation.socStockFromReport")}</option>
                    <option value="layers">{t("admin.fieldObservation.socCalculateLayers")}</option>
                  </select>
                </label>
                {layerMode && (
                  <div className="col-12">
                    <p className="small text-muted">
                      {t("admin.fieldObservation.soilLayerHint")}
                    </p>
                    {layers.map((id, i) => (
                      <div className="field-soil-layer" key={id}>
                        <strong>{t("admin.fieldObservation.layer", { index: i + 1 })}</strong>
                        <div className="row g-2">
                          {numeric(`top_${id}`, t("admin.fieldObservation.topCm"), 0)}
                          {numeric(`bottom_${id}`, t("admin.fieldObservation.bottomCm"), 0.01, 1000)}
                          {numeric(`carbon_${id}`, t("admin.fieldObservation.organicCarbon"), 0, 1000)}
                          {numeric(`density_${id}`, t("admin.fieldObservation.bulkDensity"), 0.001, 3)}
                          {numeric(`coarse_${id}`, t("admin.fieldObservation.coarseFragments"), 0, 99.99)}
                        </div>
                        {layers.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger mt-2"
                            onClick={() => setLayers(layers.filter((key) => key !== id))}
                          >
                            {t("admin.fieldObservation.removeLayer", { index: i + 1 })}
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
                      {t("admin.fieldObservation.addLayer")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="small text-muted mt-3">
            {t("admin.fieldObservation.saveNote")}
          </p>
          <button className="btn btn-primary" type="submit">
            {busy ? t("admin.fieldObservation.saving") : t("admin.fieldObservation.save")}
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
