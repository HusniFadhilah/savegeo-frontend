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

/**
 * Item 4 of the redesign spec (D.4): KPI tiles from `GET
 * /disasters/{id}/statistics`'s `kpis` (namespaced by model_id per the
 * contract doc). One metric-card group per model with a published result,
 * headed by its `user_label` (never the raw `model_id`).
 */
export default function KpiTiles({ kpis, analyses }: Props) {
  const entries = Object.entries(kpis).filter(([, stats]) => stats && Object.keys(stats).length);
  if (!entries.length) {
    return <div className="alert alert-secondary py-2 mb-3">Belum ada statistik hasil analisis yang dipublikasikan.</div>;
  }

  return (
    <div className="mb-3">
      {entries.map(([modelId, stats]) => {
        const label = analyses.find((a) => a.model_id === modelId)?.user_label ?? modelId;
        return (
          <div className="mb-2" key={modelId}>
            <div className="fw-semibold small text-muted mb-1">{label}</div>
            <div className="row g-2">
              {Object.entries(stats).map(([key, value]) => (
                <div className="col-6 col-md-3" key={key}>
                  <div className="metric-card">
                    <div className="metric-value">{formatValue(key, value)}</div>
                    <div className="metric-label">{humanizeKey(key)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
