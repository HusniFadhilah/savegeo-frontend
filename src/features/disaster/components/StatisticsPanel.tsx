import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import type { DisasterAnalysisEntry, DisasterStatisticsResponse } from "../types";
import { statisticMetric } from "../lib/statisticMetrics";
import { useI18nStore } from "@/hooks/useI18nStore";

// Same chart.js registration pattern as lc-change/components/TimeSeriesChart.tsx
// / NetChangeChart.tsx - this repo uses chart.js + react-chartjs-2, not
// recharts/d3.
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BAR_COLORS = [
  "rgba(21,101,192,0.82)",
  "rgba(229,57,53,0.82)",
  "rgba(46,125,50,0.82)",
  "rgba(255,179,0,0.82)",
  "rgba(142,68,173,0.82)",
];

interface Props {
  kpis: DisasterStatisticsResponse["kpis"];
  analyses: DisasterAnalysisEntry[];
}

/**
 * Item 7 of the redesign spec (D.7): chart.js visualization of `kpis`, one
 * card per published model result. All 3 MVP models only ever produce
 * numeric area (ha) statistics (see `disaster_analysis_service.py`'s
 * `_compute_*` functions) so a horizontal bar chart of each stat is a
 * reasonable, uniform default across categories - there's no natural
 * pie-chart breakdown (parts of a whole) in any of the 3 models' current
 * output.
 */
export default function StatisticsPanel({ kpis, analyses }: Props) {
  const { language } = useI18nStore();
  const indonesian = language === "id";
  const entries = Object.entries(kpis).filter(([modelId, stats]) =>
    stats && Object.entries(stats).some(([key, value]) => key !== "aoi_area_ha" && statisticMetric(key) && typeof value === "number" && Number.isFinite(value)) && analyses.some((analysis) => analysis.model_id === modelId && analysis.available),
  );
  if (!entries.length) {
    return (
      <div className="disaster-stats-empty">
        <i className="bi bi-bar-chart" aria-hidden="true" />
        {indonesian ? "Belum ada data statistik untuk ditampilkan sebagai grafik." : "No statistics are available to chart."}
      </div>
    );
  }

  return (
    <details className="disaster-statistics-details">
      <summary>
        <span><i className="bi bi-bar-chart-line-fill" aria-hidden="true" /> {indonesian ? "Grafik statistik" : "Statistics charts"}</span>
        <small>{entries.length} {indonesian ? "dataset" : "datasets"}</small>
      </summary>
      <div className="row g-3 disaster-stat-grid">
        {entries.map(([modelId, stats]) => {
        const analysis = analyses.find((a) => a.model_id === modelId);
        const label = analysis?.user_label ?? modelId;
        const rows = Object.entries(stats).filter((entry): entry is [string, number] => entry[0] !== "aoi_area_ha" && statisticMetric(entry[0]) !== null && typeof entry[1] === "number" && Number.isFinite(entry[1]));
        if (!rows.length) return null;
        const groups = new Map<string, [string, number][]>();
        for (const row of rows) {
          const unit = statisticMetric(row[0])?.unit ?? "";
          groups.set(unit, [...(groups.get(unit) ?? []), row]);
        }

        return (
          <div className="col-lg-6" key={modelId}>
            <div className="card h-100 disaster-modern-card disaster-chart-card">
              <div className="card-header py-2 disaster-soft-header"><i className="bi bi-map me-2" aria-hidden="true" />{label}</div>
              <div className="card-body">
                {[...groups].map(([unit, group]) => <div key={unit} className="mb-3 disaster-chart-unit" style={{ height: Math.max(180, Math.min(320, group.length * 34)) }}>
                  <Bar
                    data={{ labels: group.map(([key]) => statisticMetric(key)?.label ?? key), datasets: [{label, data: group.map(([, value]) => value), backgroundColor: group.map((_, i) => BAR_COLORS[i % BAR_COLORS.length])}] }}
                    options={{
                      indexAxis: "y",
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx) => `${ctx.label}: ${ctx.formattedValue} ${unit}`.trim(),
                          },
                        },
                      },
                      scales: { x: { title: { display: true, text: unit || "Nilai" } } },
                    }}
                  />
                </div>)}
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </details>
  );
}
