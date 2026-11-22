import { useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";

export default function DetritusSampleFields({ pool }: { pool: "litter" | "deadwood" }) {
  const t = useI18nStore((state) => state.t);
  const [pieces, setPieces] = useState([0]);
  const number = (name: string, label: string, min = 0, step = "any") => (
    <label className="col-md-4 form-label">
      {label}
      <input name={name} type="number" step={step} min={min} required className="form-control" />
    </label>
  );
  if (pool === "litter")
    return (
      <div className="col-12">
        <div className="border rounded p-3">
          <h4 className="h6">{t("admin.detritus.litter.title")}</h4>
          <p className="small text-muted">
            {t("admin.detritus.litter.hint")}
          </p>
          <div className="row g-2">
            {number("litterWet", t("admin.detritus.litter.compositeWetMass"), 0.000001)}
            {number("litterSubWet", t("admin.detritus.litter.subsampleWetMass"), 0.000001)}
            {number("litterSubDry", t("admin.detritus.litter.subsampleDryMass"))}
            {number("litterQuadrats", t("admin.detritus.litter.quadratCount"), 1, "1")}
            {number("litterQuadratArea", t("admin.detritus.litter.quadratArea"), 0.000001)}
            {number("litterDiameter", t("admin.detritus.litter.maxDiameter"), 0.000001)}
          </div>
        </div>
      </div>
    );
  return (
    <div className="col-12">
      <div className="border rounded p-3">
        <h4 className="h6">{t("admin.detritus.deadwood.title")}</h4>
        <p className="small text-muted">
          {t("admin.detritus.deadwood.hint")}
        </p>
        <div className="row g-2">
          {number("deadwoodDiameter", t("admin.detritus.deadwood.minDiameter"), 0.000001)}
        </div>
        {pieces.map((id, index) => (
          <fieldset key={id} className="border rounded p-2 mt-2">
            <legend className="float-none w-auto fs-6 px-1">{t("admin.detritus.deadwood.component", { index: index + 1 })}</legend>
            <div className="row g-2">
              <label className="col-md-4 form-label">
                {t("admin.detritus.deadwood.position")}
                <select name="deadwoodComponent" className="form-select">
                  <option value="standing">{t("admin.detritus.deadwood.standing")}</option>
                  <option value="downed">{t("admin.detritus.deadwood.downed")}</option>
                </select>
              </label>
              {number("deadwoodVolume", t("admin.detritus.deadwood.volume"), 0.000001)}
              {number("deadwoodDensity", t("admin.detritus.deadwood.dryDensity"), 0.000001)}
              <label className="col-md-4 form-label">
                {t("admin.detritus.deadwood.decayClass")}
                <input name="deadwoodDecay" className="form-control" maxLength={64} required />
              </label>
              <label className="col-md-8 form-label">
                {t("admin.detritus.deadwood.densitySource")}
                <input
                  name="deadwoodDensitySource"
                  className="form-control"
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </label>
            </div>
            {pieces.length > 1 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger mt-2"
                onClick={() => setPieces(pieces.filter((value) => value !== id))}
              >
                {t("admin.detritus.deadwood.removeComponent", { index: index + 1 })}
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary mt-2"
          disabled={pieces.length >= 500}
          onClick={() => setPieces([...pieces, Math.max(...pieces) + 1])}
        >
          {t("admin.detritus.deadwood.addComponent")}
        </button>
      </div>
    </div>
  );
}
