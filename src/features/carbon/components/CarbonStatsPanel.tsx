import type { CarbonResult } from "@/features/carbon/types";

interface Props {
  result: CarbonResult;
}

function StatRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="cs-stat-row">
      <span className="cs-stat-label">{label}</span>
      <span className={`cs-stat-value ${strong ? "cs-stat-value-strong" : ""}`}>{value}</span>
    </div>
  );
}

/** Ported from main.js displayCarbonStats(): density/total tables + model performance. */
export default function CarbonStatsPanel({ result }: Props) {
  const stats = result.carbon_estimated?.statistics || {};
  const areaInfo = result.area_info || {};
  const modelInfo = result.model_info || {};
  const reference = result.carbon_reference;
  const perf = result.model_performance;

  const calculationAreaHa = areaInfo.calculation_area_ha ?? areaInfo.area_ha ?? 0;
  const isClipped = modelInfo.calculation_mode === "clipped_aoi";

  const fmt = (n: number, digits = 2) => n.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmtInt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 0 });

  return (
    <div className="mt-4 cs-panel">
      <h5 className="mb-3">
        <i className="bi bi-tree me-1" /> Analisis Stok Karbon
      </h5>

      <div className={`cs-mode-bar ${isClipped ? "cs-mode-bar-clipped" : "cs-mode-bar-full"}`}>
        <div className="cs-mode-col">
          <div className="cs-mode-title">
            <i className={`bi ${isClipped ? "bi-scissors" : "bi-layers"}`} />
            {isClipped ? "Mode Clipped" : "Mode Bounding Box"}
          </div>
          <div className="cs-mode-detail">
            Luas: <strong>{fmtInt(calculationAreaHa)} ha</strong>
            {areaInfo.description ? <span className="cs-mode-desc"> · {areaInfo.description}</span> : null}
          </div>
        </div>
        {reference && (
          <div className="cs-mode-col">
            <div className="cs-mode-title">
              <i className="bi bi-database" />
              Dataset Referensi
            </div>
            <div className="cs-mode-detail">
              {reference.name || reference.full_name || "N/A"}
              {reference.year != null ? ` (${reference.year})` : ""}
              {reference.resolution ? <span className="cs-mode-desc"> · Resolusi {reference.resolution}m</span> : null}
            </div>
          </div>
        )}
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="cs-card">
            <div className="cs-card-header">
              <i className="bi bi-bar-chart-line" /> Statistik Densitas Karbon
            </div>
            <div className="cs-card-body">
              <StatRow label="Mean" value={`${fmt(stats.mean ?? 0)} Mg/ha`} strong />
              <StatRow label="Std Dev" value={`${fmt(stats.std_dev ?? 0)} Mg/ha`} />
              <StatRow label="Min" value={`${fmt(stats.min ?? 0)} Mg/ha`} />
              <StatRow label="Max" value={`${fmt(stats.max ?? 0)} Mg/ha`} />
            </div>
            {(reference?.name || reference?.full_name) && (
              <div className="cs-card-footer">
                <i className="bi bi-info-circle me-1" />
                Referensi: {reference.full_name || reference.name}
              </div>
            )}
          </div>
        </div>

        <div className="col-md-6">
          <div className="cs-card">
            <div className="cs-card-header">
              <i className="bi bi-clipboard-data" /> Total Stok Karbon
            </div>
            <div className="cs-card-body">
              <StatRow label="Luas Perhitungan" value={`${fmtInt(calculationAreaHa)} ha`} />
              <StatRow label="Total Karbon" value={`${fmtInt(areaInfo.total_carbon_tons ?? 0)} ton`} strong />
              <StatRow label="Setara CO₂" value={`${fmtInt(areaInfo.carbon_dioxide_equivalent_tons ?? 0)} ton CO₂e`} strong />
            </div>
            <div className="cs-card-footer">
              <i className="bi bi-info-circle me-1" />
              CO₂ equivalent = Karbon × 3.67 (faktor konversi IPCC)
            </div>
          </div>
        </div>
      </div>

      <div className="cs-card mt-3">
        <div className="cs-card-header">
          <i className="bi bi-gear" /> Konfigurasi Model
        </div>
        <div className="cs-card-body">
          <div className="cs-config-grid">
            <div className="cs-config-item">
              <span className="cs-config-label">Dataset Referensi</span>
              <span className="cs-config-value">{reference?.name || reference?.full_name || "-"}</span>
            </div>
            <div className="cs-config-item">
              <span className="cs-config-label">Skala Proses</span>
              <span className="cs-config-value">{modelInfo.scale ? `${modelInfo.scale}m` : "-"}</span>
            </div>
            <div className="cs-config-item">
              <span className="cs-config-label">Mode Tampilan</span>
              <span className="cs-config-value">{modelInfo.display_mode || (isClipped ? "Clipped" : "Full Tiles")}</span>
            </div>
          </div>

          {modelInfo.model_name && (
            <div className="cs-model-used">
              <i className="bi bi-cpu me-1" />
              Model terlatih digunakan: <code>{modelInfo.model_name}</code>
            </div>
          )}

          {perf && (
            <div className="cs-perf-row">
              {perf.r2_score !== undefined && (
                <span className={`cs-perf-badge ${perf.r2_score >= 0.7 ? "cs-perf-good" : perf.r2_score >= 0.5 ? "cs-perf-mid" : "cs-perf-low"}`}>
                  R² {perf.r2_score.toFixed(3)}
                </span>
              )}
              {perf.rmse !== undefined && (
                <span className="cs-perf-badge cs-perf-neutral">
                  RMSE {perf.rmse.toFixed(2)} Mg/ha{perf.rmse_std ? ` ± ${perf.rmse_std.toFixed(2)}` : ""}
                </span>
              )}
              {perf.cv_folds !== undefined && (
                <span className="cs-perf-badge cs-perf-neutral">CV {perf.cv_folds}-fold</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
