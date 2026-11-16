import { number, useCopy } from "./helpers";
import type { IntegrityResult } from "./types";

export default function RecordResults({ result }: { result: IntegrityResult }) {
  const c = useCopy();
  const warningText: Record<string, string> = {
    cross_year_reference_predictor: c(
      "Tahun observasi dan prediktor berbeda.",
      "Observation and predictor years differ.",
    ),
    few_spatial_blocks: c(
      "Blok spasial sedikit; interpretasikan interval dengan hati-hati.",
      "Few spatial blocks; interpret intervals cautiously.",
    ),
    map_agreement_not_field_accuracy: c(
      "Referensi berasal dari peta; metrik mengukur kesesuaian antarpeta.",
      "The reference is a map; metrics measure agreement between maps.",
    ),
    spatial_calibration_incomplete: c(
      "Data belum mendukung kalibrasi pada semua fold setelah buffer.",
      "Data do not support calibration in every fold after buffering.",
    ),
    validation_points_outside_project: c(
      "Sebagian titik berada di luar batas proyek.",
      "Some points are outside the project boundary.",
    ),
    project_boundary_not_available: c(
      "Kecocokan titik dengan batas proyek belum diperiksa karena batas belum tersedia.",
      "Point coverage cannot be checked until a project boundary is available.",
    ),
  };
  const inputs: Record<string, string> = {
    project_emissions_tco2e: c("emisi proyek", "project emissions"),
    leakage_tco2e: "leakage",
    uncertainty_deduction_pct: c("pengurangan ketidakpastian", "uncertainty deduction"),
    buffer_pct: c("cadangan buffer", "buffer reserve"),
  };
  return (
    <>
      {result.raw_map ? (
        <div className="table-responsive">
          <table className="table integrity-results-table">
            <thead>
              <tr>
                <th>{c("Evaluasi", "Evaluation")}</th>
                <th>N</th>
                <th>R²</th>
                <th>RMSE</th>
                <th>MAE</th>
                <th>Bias</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{c("Prediksi awal", "Raw prediction")}</td>
                <td>{result.raw_map.n}</td>
                <td>{number(result.raw_map.r2, 3)}</td>
                <td>{number(result.raw_map.rmse)}</td>
                <td>{number(result.raw_map.mae)}</td>
                <td>{number(result.raw_map.bias)}</td>
              </tr>
              {result.calibrated_oof ? (
                <tr>
                  <td>{c("Kalibrasi OOF spasial", "Spatial OOF calibration")}</td>
                  <td>{result.calibrated_oof.n}</td>
                  <td>{number(result.calibrated_oof.r2, 3)}</td>
                  <td>{number(result.calibrated_oof.rmse)}</td>
                  <td>{number(result.calibrated_oof.mae)}</td>
                  <td>{number(result.calibrated_oof.bias)}</td>
                </tr>
              ) : null}
            </tbody>
            <caption>
              {c(
                "Satuan error mengikuti dataset yang diunggah.",
                "Error units follow the uploaded dataset.",
              )}{" "}
              · {result.n_blocks} {c("blok spasial", "spatial blocks")}
            </caption>
          </table>
        </div>
      ) : null}
      {result.lines ? (
        <>
          <div className="table-responsive">
            <table className="table integrity-results-table">
              <thead>
                <tr>
                  <th>Pool</th>
                  <th>{c("ΔC proyek (Mg C)", "Project ΔC (Mg C)")}</th>
                  <th>{c("ΔC baseline (Mg C)", "Baseline ΔC (Mg C)")}</th>
                  <th>{c("Tambahan (tCO₂)", "Additional (tCO₂)")}</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((line) => (
                  <tr key={line.pool}>
                    <td>{line.pool}</td>
                    <td>{number(line.project_change_mg_c)}</td>
                    <td>{number(line.baseline_change_mg_c)}</td>
                    <td>{number(line.additional_tco2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="integrity-metrics-inline">
            <span>
              {c("Mitigasi neto", "Net mitigation")}{" "}
              <strong>{number(result.net_mitigation_tco2e)} tCO₂e</strong>
            </span>
            <span>
              {c("Skenario setelah pengurangan", "Scenario after deductions")}{" "}
              <strong>{number(result.scenario_units_tco2e)} tCO₂e</strong>
            </span>
          </div>
        </>
      ) : null}
      {result.missing_inputs?.length ? (
        <p className="integrity-quality-note">
          {c("Input belum diketahui", "Inputs still unknown")}:{" "}
          {result.missing_inputs.map((key) => inputs[key] || key).join(", ")}.
        </p>
      ) : null}
      {result.warnings?.length ? (
        <ul className="integrity-quality-note">
          {result.warnings.map((warning) => (
            <li key={warning}>
              {warningText[warning] ||
                c(
                  "Ada catatan mutu tambahan; lihat rincian hasil.",
                  "Additional quality notes are available in the result details.",
                )}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
