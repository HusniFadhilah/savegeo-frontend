import type { DisasterAnalysisEntry, DisasterStatisticsResponse } from "../types";

interface Props {
  kpis: DisasterStatisticsResponse["kpis"];
  analyses: DisasterAnalysisEntry[];
}

function humanizeKey(key: string): string {
  const withoutSuffix = key.replace(/_ha$/, "");
  const words = withoutSuffix.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(" ");
}

function formatValue(key: string, value: number | string | null): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    const formatted = value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
    return key.endsWith("_ha") ? `${formatted} ha` : formatted;
  }
  return String(value);
}

function modelIcon(modelId: string): string {
  if (modelId.includes("water") || modelId.includes("flood")) return "bi-water";
  if (modelId.includes("forest")) return "bi-tree";
  if (modelId.includes("landslide")) return "bi-triangle";
  if (modelId.includes("earthquake")) return "bi-activity";
  return "bi-cpu";
}

function metricIcon(key: string): string {
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
  const entries = Object.entries(kpis).filter(([modelId, stats]) =>
    stats && Object.keys(stats).length && analyses.some((analysis) => analysis.model_id === modelId && analysis.available),
  );
  if (!entries.length) {
    return (
      <div className="alert alert-secondary py-2 mb-3">
        Belum ada statistik hasil analisis yang dipublikasikan.
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
              <i className={`bi ${modelIcon(modelId)}`} />
              {label}
            </div>
            {analysis && !analysis.damage_model && (
              <div className="alert alert-warning py-1 px-2 mb-2 small">
                <i className="bi bi-info-circle me-1" />
                Statistik ini adalah {analysis.result_semantics === "water_extent" ? "luas air terdeteksi" : "indikator perubahan"}, bukan estimasi kerusakan terlatih.
                {analysis.limitations?.[0] ? ` ${analysis.limitations[0]}` : ""}
              </div>
            )}
            <div className="row g-2">
              {Object.entries(stats).map(([key, value]) => (
                <div className="col-6 col-md-3" key={key}>
                  <div className="metric-card">
                    <div className="disaster-metric-icon">
                      <i className={`bi ${metricIcon(key)}`} />
                    </div>
                    <div className="metric-value">{formatValue(key, value)}</div>
                    <div className="metric-label">{humanizeKey(key)}</div>
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
