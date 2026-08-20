import type { ReactNode } from "react";
import type { AnalysisResultsBundle } from "@/features/reports/export";
import type { AnalysisProcessingTimes } from "@/features/carbon/types";
import { isLandCoverDatasetEntry } from "@/features/landcover/types";

interface Props {
  results: AnalysisResultsBundle;
  processingTimes: AnalysisProcessingTimes;
}

function formatDuration(seconds?: string | number): string {
  const sec = parseFloat(String(seconds ?? ""));
  if (!Number.isFinite(sec)) return "-";
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const mins = Math.floor(sec / 60);
  const secs = (sec % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

function MetricCard({ icon, value, label, sub }: { icon: string; value: ReactNode; label: string; sub?: string }) {
  return (
    <div className="col-md-3">
      <div className="metric-card">
        <div className="metric-icon">
          <i className={`bi ${icon}`} />
        </div>
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
        {sub && <small className="text-muted d-block mt-1">{sub}</small>}
      </div>
    </div>
  );
}

/** Ported from main.js displayMetrics() + displayProcessingTimes(). */
export default function StatsCards({ results, processingTimes }: Props) {
  const cards: ReactNode[] = [];

  if (results.vegetation?.indices) {
    const idx = results.vegetation.indices;
    const vals = Object.values(idx).map((v) => Number(v.mean)).filter((v) => Number.isFinite(v));
    const avgMean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    cards.push(
      <MetricCard key="veg-images" icon="bi-images" value={results.vegetation.collection_size ?? 0} label="Citra Ditemukan" />,
      <MetricCard key="veg-count" icon="bi-flower1" value={Object.keys(idx).length} label="Indeks Dianalisis" />,
      <MetricCard key="veg-mean" icon="bi-graph-up" value={avgMean.toFixed(3)} label="Rata-rata Nilai" />,
    );
  }

  if (results.carbon) {
    const c = results.carbon;
    const stats = c.carbon_estimated?.statistics || {};
    const areaInfo = c.area_info || {};
    // `model_performance` was never actually populated by the backend (dead
    // field, verified live) - the real R²/RMSE live under model_info.cv_metrics.
    const cv = c.model_info?.cv_metrics || {};
    const perf = {
      r2_score: cv.r2_mean,
      rmse: cv.rmse_mean,
      rmse_std: cv.rmse_std,
      cv_folds: cv.n_folds ?? cv.cv_folds,
    };
    const hasCV = (perf.cv_folds ?? 0) > 0 && perf.r2_score !== undefined;
    const calculationMode = c.model_info?.calculation_mode || "unknown";

    cards.push(
      <MetricCard
        key="carbon-density"
        icon="bi-tree"
        value={<>{(stats.mean ?? 0).toFixed(2)} <small>Mg/ha</small></>}
        label="Rata-rata Densitas Karbon"
      />,
      <MetricCard
        key="carbon-total"
        icon="bi-clipboard-data"
        value={<>{(areaInfo.total_carbon_tons ?? 0).toLocaleString()} <small>ton</small></>}
        label="Total Stok Karbon"
        sub={calculationMode === "clipped_aoi" ? "Dipotong sesuai AOI" : "Bounding box"}
      />,
      <MetricCard
        key="carbon-co2"
        icon="bi-cloud"
        value={<>{(areaInfo.carbon_dioxide_equivalent_tons ?? 0).toLocaleString()} <small>ton</small></>}
        label="Setara CO2"
      />,
      hasCV ? (
        <MetricCard
          key="carbon-r2"
          icon="bi-bar-chart"
          value={
            <span className={`badge bg-${(perf.r2_score ?? 0) >= 0.7 ? "success" : (perf.r2_score ?? 0) >= 0.5 ? "warning" : "danger"}`} style={{ fontSize: "1.2rem" }}>
              {(perf.r2_score ?? 0).toFixed(3)}
            </span>
          }
          label="R² Score (CV)"
          sub={`RMSE: ${(perf.rmse ?? 0).toFixed(2)} Mg/ha`}
        />
      ) : (
        <MetricCard key="carbon-rmse" icon="bi-bar-chart" value={(perf.rmse ?? 0).toFixed(2)} label="Model RMSE" />
      ),
    );
  }

  if (results.landcover) {
    const lc = results.landcover;
    const datasetEntries = Object.entries(lc).filter(([k, v]) => isLandCoverDatasetEntry(k, v));
    const preferredOrder = ["Dynamic_World", "ESA_WorldCover", "ESRI_LandCover", "MapBiomas_Indonesia", "Copernicus_LandCover", "MODIS_LandCover"];
    const preferred = preferredOrder
      .map((key) => datasetEntries.find(([k]) => k === key))
      .find((entry): entry is (typeof datasetEntries)[number] => !!entry) || datasetEntries[0];

    if (preferred && isLandCoverDatasetEntry(preferred[0], preferred[1])) {
      const classes = preferred[1].classes;
      const totalArea = Object.values(classes).reduce((s, c) => s + Number(c.area || 0), 0);
      let dominantClass = "";
      let dominantPct = 0;
      for (const [name, d] of Object.entries(classes)) {
        if ((d.percentage || 0) > dominantPct) {
          dominantClass = name;
          dominantPct = d.percentage || 0;
        }
      }
      if (totalArea > 0) {
        cards.push(
          <MetricCard
            key="lc-area"
            icon="bi-globe-asia-australia"
            value={<>{totalArea.toLocaleString(undefined, { maximumFractionDigits: 1 })} <small>ha</small></>}
            label="Luas Total"
          />,
        );
      }
      if (dominantClass) {
        cards.push(
          <MetricCard
            key="lc-dominant"
            icon="bi-map"
            value={<>{dominantPct.toFixed(1)} <small>%</small></>}
            label={dominantClass.replace(/_/g, " ")}
            sub="Kelas Dominan"
          />,
        );
      }
    }
    cards.push(
      <MetricCard key="lc-count" icon="bi-layers" value={datasetEntries.length} label="Dataset Dianalisis" />,
    );
  }

  const timeSections = [
    { key: "vegetation" as const, icon: "bi-flower1", label: "Vegetasi", color: "#43a047" },
    { key: "landcover" as const, icon: "bi-map", label: "Tutupan Lahan", color: "#1e88e5" },
    { key: "carbon" as const, icon: "bi-tree", label: "Karbon", color: "#fb8c00" },
    { key: "total" as const, icon: "bi-stopwatch", label: "Total Waktu", color: "#1e88e5" },
  ].filter((s) => processingTimes[s.key]);

  return (
    <>
      {cards.length > 0 && <div className="row">{cards}</div>}
      {timeSections.length > 0 && (
        <div className="cs-card mt-3">
          <div className="cs-card-header">
            <i className="bi bi-clock" /> Waktu Proses
          </div>
          <div className="cs-card-body">
            <div className="row row-cols-2 row-cols-md-4 g-2">
              {timeSections.map((s) => (
                <div className="col" key={s.key}>
                  <div className="text-center p-2">
                    <i className={`bi ${s.icon}`} style={{ fontSize: 22, color: s.color }} />
                    <div className="cs-time-value">{formatDuration(processingTimes[s.key])}</div>
                    <small className="text-muted">{s.label}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
