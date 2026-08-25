import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";
import type { LandCoverDatasetResult, LandCoverResult } from "@/features/landcover/types";
import { isLandCoverDatasetEntry } from "@/features/landcover/types";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

const COMPARE_COLORS = [
  "rgba(46,125,50,0.85)",
  "rgba(30,111,199,0.85)",
  "rgba(255,167,38,0.85)",
  "rgba(142,68,173,0.85)",
];

const CLASS_GROUPS: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: "Built Area",
    patterns: [/^built[-\s]?up$/i, /^built area$/i, /^urban/i, /^impervious/i],
  },
  { label: "Trees / Forest", patterns: [/^trees?$/i, /forest/i, /mangrove/i] },
  {
    label: "Water",
    patterns: [/^water$/i, /open water/i, /water bod/i, /river/i, /lake/i, /ocean/i],
  },
  {
    label: "Crops / Agriculture",
    patterns: [/crop/i, /agriculture/i, /rice/i, /oil palm/i, /pulpwood/i],
  },
  { label: "Grassland", patterns: [/^grass$/i, /grassland/i, /rangeland/i] },
  { label: "Shrub / Scrub", patterns: [/shrub/i, /scrub/i] },
  {
    label: "Bare Ground",
    patterns: [/bare/i, /barren/i, /sparse/i, /non-vegetated/i, /other non-vegetation/i],
  },
  {
    label: "Flooded Vegetation / Wetland",
    patterns: [/flooded/i, /wetland/i, /swamp/i, /marsh/i, /peat/i],
  },
  { label: "Mining", patterns: [/mining/i] },
  { label: "Aquaculture", patterns: [/aquaculture/i] },
  { label: "Snow / Ice", patterns: [/snow/i, /ice/i] },
  { label: "Cloud / No Data", patterns: [/cloud/i, /not observed/i, /no data/i] },
];

function displayClassName(name: string): string {
  return name.replace(/_/g, " ").trim();
}

function groupedClassName(name: string): string {
  const normalized = displayClassName(name);
  const group = CLASS_GROUPS.find((item) =>
    item.patterns.some((pattern) => pattern.test(normalized)),
  );
  return group?.label ?? normalized;
}

interface Props {
  result: LandCoverResult;
}

/**
 * Ported from main.js renderLandCoverTableAndChart(): a class table + pie
 * chart per land-cover dataset in the response (Dynamic World, ESA
 * WorldCover, ESRI Land Cover, or any other dataset key present).
 */
export default function LandCoverResultTables({ result }: Props) {
  const entries = Object.entries(result).filter(([key, value]) =>
    isLandCoverDatasetEntry(key, value),
  );

  if (!entries.length) return null;

  return (
    <div className="mt-4">
      <h5 className="mb-3">
        <i className="bi bi-map me-1" /> Analisis Tutupan Lahan
      </h5>
      {entries.map(([key, value]) => {
        if (!isLandCoverDatasetEntry(key, value)) return null;
        const label = value.dataset_name || key.replace(/_/g, " ");
        const sorted = Object.entries(value.classes).sort(
          (a, b) => Number(b[1].area || 0) - Number(a[1].area || 0),
        );
        const totalArea = sorted.reduce((sum, [, info]) => sum + Number(info.area || 0), 0);

        return (
          <div className="row mb-4" key={key}>
            <div className="col-md-6">
              <h6 className="mb-2">
                <i className="bi bi-layers me-1" /> {label}
              </h6>
              <div className="table-responsive">
                <table className="table table-striped table-hover table-sm">
                  <thead className="table-secondary">
                    <tr>
                      <th>Kelas</th>
                      <th>Luas (ha)</th>
                      <th>Persentase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(([name, info]) => (
                      <tr key={name}>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              width: 12,
                              height: 12,
                              backgroundColor: info.color,
                              marginRight: 5,
                              border: "1px solid #ccc",
                            }}
                          />
                          <strong>{displayClassName(name)}</strong>
                        </td>
                        <td>
                          {Number(info.area || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td>
                          <span className="badge bg-primary">
                            {Number(info.percentage || 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="table-light">
                      <td>
                        <strong>Total</strong>
                      </td>
                      <td>
                        <strong>
                          {totalArea.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </td>
                      <td>
                        <strong>100.0%</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="col-md-6">
              <h6 className="mb-2">Diagram Distribusi</h6>
              <div className="card">
                <div className="card-body">
                  <Pie
                    data={{
                      labels: sorted.map(([name]) => displayClassName(name)),
                      datasets: [
                        {
                          data: sorted.map(([, info]) => Number(info.area || 0)),
                          backgroundColor: sorted.map(([, info]) => info.color || "#999"),
                          borderWidth: 2,
                          borderColor: "#fff",
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: { boxWidth: 15, padding: 10, font: { size: 11 } },
                        },
                        title: {
                          display: true,
                          text: `${label} - ${value.year ?? ""}`,
                          font: { size: 14, weight: "bold" },
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const v = context.parsed;
                              const total = (context.dataset.data as number[]).reduce(
                                (a, b) => a + b,
                                0,
                              );
                              const pct = total ? ((v / total) * 100).toFixed(1) : "0";
                              return ` ${context.label}: ${v.toLocaleString()} ha (${pct}%)`;
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {entries.length > 1 &&
        (() => {
          const datasets = (entries as [string, unknown][]).filter(
            (e): e is [string, LandCoverDatasetResult] =>
              isLandCoverDatasetEntry(e[0], e[1]) && !!e[1] && "classes" in (e[1] as object),
          );
          if (datasets.length < 2) return null;

          // Top 8 classes by their highest share in any one dataset, so the
          // comparison stays readable instead of listing every class each
          // dataset happens to detect.
          const groupedByDataset = datasets.map(([key, value]) => {
            const classes = new Map<string, number>();
            Object.entries(value.classes).forEach(([name, info]) => {
              const groupName = groupedClassName(name);
              classes.set(groupName, (classes.get(groupName) ?? 0) + Number(info.percentage || 0));
            });
            return { key, value, classes };
          });

          const byClass = new Map<string, number>();
          groupedByDataset.forEach(({ classes }) => {
            classes.forEach((percentage, name) => {
              byClass.set(name, Math.max(byClass.get(name) ?? 0, percentage));
            });
          });
          const topClasses = [...byClass.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name]) => name);
          if (!topClasses.length) return null;

          return (
            <div className="card mb-4">
              <div className="card-body">
                <h6 className="mb-3">
                  <i className="bi bi-bar-chart-fill me-1" /> Perbandingan Antar Dataset (Top{" "}
                  {topClasses.length} Kelas)
                </h6>
                <div style={{ height: Math.max(260, topClasses.length * 34) }}>
                  <Bar
                    data={{
                      labels: topClasses,
                      datasets: groupedByDataset.map(({ key, value, classes }, i) => ({
                        label: value.dataset_name || key.replace(/_/g, " "),
                        data: topClasses.map((name) => Number(classes.get(name) || 0)),
                        backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
                      })),
                    }}
                    options={{
                      indexAxis: "y",
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: "top" } },
                      scales: { x: { title: { display: true, text: "% Luas AOI" } } },
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
