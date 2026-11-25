import { number, useCopy } from "./helpers";
import type { IntegrityResult } from "./types";

export default function RecordResults({ result }: { result: IntegrityResult }) {
  const c = useCopy();
  const metric = (value: unknown, digits = 2) =>
    typeof value === "number" ? number(value, digits) : "—";
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
      {typeof result.calculation_status === "string" ? (
        <div className="integrity-metrics-inline">
          <span>{c("Status kalkulasi", "Calculation status")} <strong>{result.calculation_status}</strong></span>
          {typeof result.gross_screening_tco2e === "number" ? <span>{c("Screening gross", "Gross screening")} <strong>{metric(result.gross_screening_tco2e)} tCO2e</strong></span> : null}
          {typeof result.net_screening_tco2e === "number" ? <span>{c("Screening neto", "Net screening")} <strong>{metric(result.net_screening_tco2e)} tCO2e</strong></span> : null}
          {typeof result.current_census_stock_tco2e === "number" ? <span>{c("Stok sensus saat ini", "Current census stock")} <strong>{metric(result.current_census_stock_tco2e)} tCO2e</strong></span> : null}
          {typeof result.measurement_standard_uncertainty_tco2e === "number" ? <span>{c("SE pengukuran", "Measurement SE")} <strong>{metric(result.measurement_standard_uncertainty_tco2e)} tCO2e</strong></span> : null}
        </div>
      ) : null}
      {typeof result.benchmark === "object" && result.benchmark !== null ? (
        <div className="integrity-metrics-inline">
          <span>{c("Dynamic performance benchmark", "Dynamic performance benchmark")} <strong>{metric((result.benchmark as Record<string, unknown>).performance_benchmark_ratio, 3)}</strong></span>
          <span>{c("Pasangan plot", "Matched plots")} <strong>{metric((result.benchmark as Record<string, unknown>).matched_project_control_plot_count, 0)}</strong></span>
          <span>{c("Signifikansi tren (z)", "Trend significance (z)")} <strong>{metric((result.benchmark as Record<string, unknown>).one_sided_z_score, 3)}</strong></span>
        </div>
      ) : null}
      {Array.isArray(result.measurement_interval_90_tco2e) && result.measurement_interval_90_tco2e.length === 2 ? <p className="integrity-quality-note">{c("Rentang pengukuran 90%", "90% measurement interval")}: {metric(result.measurement_interval_90_tco2e[0])}–{metric(result.measurement_interval_90_tco2e[1])} tCO2e</p> : null}
      {Array.isArray(result.interval_tco2e) && result.interval_tco2e.length === 2 ? (
        <div className="integrity-metrics-inline">
          <span>{c("Rentang hasil", "Result interval")} <strong>{metric(result.interval_tco2e[0])} to {metric(result.interval_tco2e[1])} tCO2e</strong></span>
          <span>{c("Sumber ketidakpastian terbesar", "Largest uncertainty source")} <strong>{String(result.largest_uncertainty_source || "—")}</strong></span>
        </div>
      ) : null}
      {typeof result.linked_uncertainty_assessment === "object" && result.linked_uncertainty_assessment !== null ? (() => {
        const uncertainty = result.linked_uncertainty_assessment as Record<string, unknown>;
        const interval = uncertainty.interval_tco2e;
        return Array.isArray(interval) && interval.length === 2 ? <p className="integrity-quality-note">{c("Anggaran ketidakpastian terhubung", "Linked uncertainty budget")}: {metric(interval[0])}–{metric(interval[1])} tCO2e · {c("belum menjadi pengurangan metodologi", "not applied as a methodology deduction")} · {c("sumber terbesar", "largest source")}: {String(uncertainty.largest_uncertainty_source || "—")}</p> : null;
      })() : null}
      {typeof result.total_leakage_tco2e === "number" ? (
        <div className="integrity-metrics-inline">
          <span>{c("Leakage total VMD0054", "VMD0054 total leakage")} <strong>{metric(result.total_leakage_tco2e)} tCO2e</strong></span>
          <span>{c("Area pembentuk leakage", "Area generating leakage")} <strong>{metric(result.area_generating_leakage_ha)} ha</strong></span>
          <span>{c("Emisi perubahan lahan", "Land-conversion emissions")} <strong>{metric(result.land_conversion_leakage_tco2e)} tCO2e</strong></span>
          {typeof result.monitoring_year === "number" ? <span>{c("Tahun monitoring", "Monitoring year")} <strong>{result.monitoring_year}</strong></span> : null}
        </div>
      ) : null}
      {typeof result.leakage_calculation_record_id === "string" ? <p className="integrity-quality-note">{c("Kalkulasi VM0047 memakai catatan VMD0054 yang diterima reviewer.", "VM0047 calculation uses a VMD0054 record accepted by a reviewer.")}</p> : null}
      {typeof result.inventory_change_tco2e === "number" ? (
        <div className="integrity-metrics-inline">
          <span>{c("Perubahan inventaris blue carbon", "Blue carbon inventory change")} <strong>{metric(result.inventory_change_tco2e)} tCO2e</strong></span>
          <span>{c("Perubahan rata-rata tahunan", "Annualized change")} <strong>{metric(result.annualized_inventory_change_tco2e_yr)} tCO2e/yr</strong></span>
          {typeof result.net_stock_change_after_reported_ch4_n2o_tco2e === "number" ? <span>{c("Setelah CH4/N2O yang dilaporkan", "After reported CH4/N2O")} <strong>{metric(result.net_stock_change_after_reported_ch4_n2o_tco2e)} tCO2e</strong></span> : null}
          {typeof result.baseline_relative_net_change_tco2e === "number" ? <span>{c("Tambahan neto vs baseline (screening)", "Net additional vs baseline (screening)")} <strong>{metric(result.baseline_relative_net_change_tco2e)} tCO2e</strong></span> : null}
          {typeof result.estimated_non_slr_erosion_emissions_tco2e_screening === "number" ? <span>{c("Emisi erosi non-SLR (screening)", "Non-SLR erosion emissions (screening)")} <strong>{metric(result.estimated_non_slr_erosion_emissions_tco2e_screening)} tCO2e</strong></span> : null}
          {typeof result.sea_level_risk_buffer_contribution_tco2e === "number" ? <span>{c("Kontribusi buffer risiko muka laut", "Sea-level risk buffer contribution")} <strong>{metric(result.sea_level_risk_buffer_contribution_tco2e)} tCO2e</strong></span> : null}
        </div>
      ) : null}
      {typeof result.recommended_plot_count === "number" ? (
        <div className="integrity-metrics-inline">
          <span>{c("Plot yang disarankan", "Recommended plots")} <strong>{number(result.recommended_plot_count, 0)}</strong></span>
          <span>{c("Jadwal ukur ulang", "Revisit schedule")} <strong>{String(result.revisit_interval_months)} {c("bulan", "months")}</strong></span>
        </div>
      ) : null}
      {typeof result.row_count === "number" ? (
        <div className="integrity-metrics-inline">
          <span>{c("Baris registry", "Registry rows")} <strong>{number(result.row_count, 0)}</strong></span>
          <span>{c("Cocok", "Matched")} <strong>{metric(result.matched_count, 0)}</strong></span>
          <span>{c("Selisih", "Mismatches")} <strong>{metric(result.mismatch_count, 0)}</strong></span>
          <span>{c("Belum ada di ledger", "Not in ledger")} <strong>{metric(result.external_only_count, 0)}</strong></span>
        </div>
      ) : null}
      {typeof result.indicator === "string" ? (
        <div className="integrity-metrics-inline">
          <span>{c("Indikator", "Indicator")} <strong>{result.indicator}</strong></span>
          <span>{c("Nilai", "Value")} <strong>{metric(result.value)} {String(result.unit || "")}</strong></span>
          {typeof result.progress_pct === "number" ? <span>{c("Capaian target", "Target progress")} <strong>{metric(result.progress_pct)}%</strong></span> : null}
        </div>
      ) : null}
      {typeof result.community_or_group === "string" ? (
        <div className="integrity-metrics-inline">
          <span>{c("Kelompok penerima", "Recipient group")} <strong>{result.community_or_group}</strong></span>
          <span>{c("Manfaat tercatat", "Recorded benefit")} <strong>{metric(result.value)} {String(result.currency_or_unit || "")}</strong></span>
          <span>{c("Status", "Status")} <strong>{String(result.status || "—")}</strong></span>
        </div>
      ) : null}
      {typeof result.field_validation === "object" && result.field_validation !== null ? <p className="integrity-quality-note">{c("Catatan lapangan terhubung", "Linked field observations")}: {metric((result.field_validation as Record<string, unknown>).capture_count, 0)} · {c("QA koordinat", "Coordinate QA")}: {String((result.field_validation as Record<string, unknown>).qa_ready ? c("lolos", "passed") : c("belum lolos", "not passed"))}</p> : null}
      {result.verified_for_reporting === true ? <p className="integrity-quality-note text-success">{c("Diterima reviewer independen untuk pelaporan", "Accepted by independent reviewer for reporting")}</p> : null}
      {typeof result.days_open_at_last_update === "number" ? (
        <div className="integrity-metrics-inline">
          <span>{c("Lama pengaduan terbuka", "Grievance age")} <strong>{number(result.days_open_at_last_update, 0)} {c("hari", "days")}</strong></span>
          {typeof result.resolution_days === "number" ? <span>{c("Waktu penyelesaian", "Resolution time")} <strong>{number(result.resolution_days, 0)} {c("hari", "days")}</strong></span> : null}
        </div>
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
