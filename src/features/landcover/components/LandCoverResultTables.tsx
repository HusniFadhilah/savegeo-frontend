import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from "chart.js";
import { Pie } from "react-chartjs-2";
import type { LandCoverResult } from "@/features/landcover/types";
import { isLandCoverDatasetEntry } from "@/features/landcover/types";

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface Props {
  result: LandCoverResult;
}

/**
 * Ported from main.js renderLandCoverTableAndChart(): a class table + pie
 * chart per land-cover dataset in the response (Dynamic World, ESA
 * WorldCover, ESRI Land Cover, or any other dataset key present).
 */
export default function LandCoverResultTables({ result }: Props) {
  const entries = Object.entries(result).filter(([key, value]) => isLandCoverDatasetEntry(key, value));

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
                          <strong>{name.replace(/_/g, " ")}</strong>
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
                      labels: sorted.map(([name]) => name.replace(/_/g, " ")),
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
                        legend: { position: "right", labels: { boxWidth: 15, padding: 10, font: { size: 11 } } },
                        title: { display: true, text: `${label} - ${value.year ?? ""}`, font: { size: 14, weight: "bold" } },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const v = context.parsed;
                              const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
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
    </div>
  );
}
