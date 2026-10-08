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
  const entries = Object.entries(kpis).filter(([modelId, stats]) =>
    stats && Object.keys(stats).length && analyses.some((analysis) => analysis.model_id === modelId && analysis.available),
  );
  if (!entries.length) {
    return (
      <div className="alert alert-secondary py-2 mb-3">
        Belum ada data statistik untuk ditampilkan sebagai grafik.
      </div>
    );
  }

  return (
    <div className="row g-3 disaster-stat-grid">
      {entries.map(([modelId, stats]) => {
        const analysis = analyses.find((a) => a.model_id === modelId);
        const label = analysis?.user_label ?? modelId;
        const rows = Object.entries(stats).filter((entry): entry is [string, number] => statisticMetric(entry[0]) !== null && typeof entry[1] === "number" && Number.isFinite(entry[1]));
        if (!rows.length) return null;
        const groups = new Map<string, [string, number][]>();
        for (const row of rows) {
          const unit = statisticMetric(row[0])?.unit ?? "";
          groups.set(unit, [...(groups.get(unit) ?? []), row]);
        }

        return (
          <div className="col-lg-6" key={modelId}>
            <div className="card h-100 disaster-modern-card disaster-chart-card">
              <div className="card-header py-2 disaster-soft-header">{label}</div>
              <div className="card-body">
                {[...groups].map(([unit, group]) => <div key={unit} className="mb-3" style={{ height: Math.max(220, group.length * 42) }}>
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
  );
}
