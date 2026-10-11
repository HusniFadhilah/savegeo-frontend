import type { DisasterAnalysisEntry, DisasterStatisticsResponse } from "../types";
import { formatStatistic, statisticMetric } from "../lib/statisticMetrics";
import InfoTip from "@/components/ui/InfoTip";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  kpis: DisasterStatisticsResponse["kpis"];
  analyses: DisasterAnalysisEntry[];
}

function modelIcon(modelId: string, semantics?: string | null): string {
  if (modelId.includes("water") || modelId.includes("flood")) return "bi-water";
  if (modelId.includes("forest")) return "bi-tree";
  if (modelId.includes("landslide")) return "bi-triangle";
  if (modelId.includes("earthquake")) return "bi-activity";
  if (semantics === "land_cover" || semantics === "change_indicator") return "bi-map";
  return "bi-cpu";
}

function metricIcon(key: string): string {
  if (key === "aoi_area_ha") return "bi-bounding-box-circles";
  if (key === "valid_area_ha") return "bi-check2-circle";
  if (key === "no_data_area_ha") return "bi-cloud-slash";
  if (key === "coverage_pct") return "bi-pie-chart";
  if (key === "changed_area_ha") return "bi-arrow-left-right";
  if (key === "total_impacted_area_ha" || key === "flooded_area_ha") return "bi-water";
  if (key.includes("exposed")) return "bi-cone-striped";
  if (key.includes("loss")) return "bi-arrow-down-right-circle";
  if (key.includes("gain")) return "bi-arrow-up-right-circle";
  if (key.includes("change") || key.includes("difference")) return "bi-arrow-left-right";
  if (key.startsWith("pre_")) return "bi-clock-history";
  if (key.startsWith("post_")) return "bi-check2-circle";
  if (key.includes("maintained")) return "bi-shield-check";
  if (key.includes("water")) return "bi-water";
  if (key.includes("forest")) return "bi-tree";
  if (key.endsWith("_ha")) return "bi-bounding-box";
  return "bi-speedometer2";
}

/**
 * Item 4 of the redesign spec (D.4): KPI tiles from `GET
 * /disasters/{id}/statistics`'s `kpis` (namespaced by model_id per the
 * contract doc). One metric-card group per model with a published result,
 * headed by its `user_label` (never the raw `model_id`).
 */
export default function KpiTiles({ kpis, analyses }: Props) {
  const { language } = useI18nStore();
  const indonesian = language === "id";
  const entries = Object.entries(kpis).filter(([modelId, stats]) =>
    stats && Object.keys(stats).some((key) => key !== "aoi_area_ha" && statisticMetric(key)) && analyses.some((analysis) => analysis.model_id === modelId && analysis.available),
  );
  if (!entries.length) {
    return (
      <div className="disaster-stats-empty">
        <i className="bi bi-bar-chart" aria-hidden="true" />
        {indonesian ? "Belum ada statistik yang dipublikasikan." : "No published statistics are available."}
      </div>
    );
  }

  return (
    <div className="mb-3 disaster-kpi-stack">
      {entries.map(([modelId, stats]) => {
        const analysis = analyses.find((a) => a.model_id === modelId);
        const label = analysis?.user_label ?? modelId;
        return (
          <section className="disaster-kpi-group" key={modelId}>
            <div className="disaster-kpi-group-title">
              <i className={`bi ${modelIcon(modelId, analysis?.result_semantics)}`} aria-hidden="true" />
              <span>{label}</span>
            </div>
            {analysis && !analysis.damage_model && (
              <div className="disaster-stats-note">
                <i className="bi bi-exclamation-circle" aria-hidden="true" />
                <span>{analysis.result_semantics === "water_extent"
                  ? (indonesian ? "Indikator luas air" : "Water extent indicator")
                  : (indonesian ? "Indikator tutupan/perubahan" : "Land-cover/change indicator")}</span>
                <InfoTip label={indonesian ? `Batas interpretasi ${label}` : `${label} interpretation limits`} content={<>
                  <p>{indonesian
                    ? `Statistik ini adalah ${analysis.result_semantics === "water_extent" ? "luas air terdeteksi" : "indikator perubahan"}, bukan estimasi kerusakan terlatih.`
                    : `These statistics show ${analysis.result_semantics === "water_extent" ? "detected water extent" : "land-cover change indicators"}, not trained damage estimates.`}</p>
                  {analysis.limitations?.length ? <ul className="mb-0 ps-3">{analysis.limitations.map(item => <li key={item}>{item}</li>)}</ul> : null}
                </>} />
              </div>
            )}
            {analysis?.validation_status === "review_required" && (
              <div className="disaster-stats-note disaster-stats-note--warning">
                <i className="bi bi-clipboard-check" aria-hidden="true" />
                <span>{indonesian ? "Perlu ditinjau" : "Review required"}</span>
                <InfoTip label={indonesian ? `Detail validasi ${label}` : `${label} validation details`} content={indonesian
                  ? "Hasil berstatus review_required; angka ini belum merupakan kerusakan terkonfirmasi."
                  : "This result is marked review_required; the values are not confirmed damage."} />
              </div>
            )}
            <div className="disaster-kpi-grid">
              {Object.entries(stats).filter(([key, value]) => key !== "aoi_area_ha" && statisticMetric(key) && (value == null || typeof value === "number" && Number.isFinite(value))).map(([key, value]) => (
                <div className="disaster-kpi-item" key={key}>
                  <div className="metric-card disaster-kpi-metric-card">
                    <i className={`bi ${metricIcon(key)} disaster-metric-icon`} aria-hidden="true" />
                    <div className="metric-value">{formatStatistic(key, value)}</div>
                    <div className="metric-label">{statisticMetric(key)?.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
