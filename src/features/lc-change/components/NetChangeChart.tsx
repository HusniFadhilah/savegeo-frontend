import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import type { LcClassInfo } from "../types";
import { translateLulcClass } from "../utils";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  clsA: Record<string, LcClassInfo>;
  clsB: Record<string, LcClassInfo>;
}

/** Horizontal net-change bar chart, ported from LCChange._renderNetChange (Plotly -> chart.js). */
export default function NetChangeChart({ clsA, clsB }: Props) {
  const all = [...new Set([...Object.keys(clsA), ...Object.keys(clsB)])];
  const rows = all
    .map((cls) => ({
      cls,
      change: Number(clsB[cls]?.area || 0) - Number(clsA[cls]?.area || 0),
    }))
    .sort((a, b) => a.change - b.change);

  if (!rows.length) return <p className="text-muted small">Tidak ada data.</p>;

  const data = {
    labels: rows.map((r) => translateLulcClass(r.cls)),
    datasets: [
      {
        label: "Perubahan Luas (ha)",
        data: rows.map((r) => Number(r.change.toFixed(1))),
        backgroundColor: rows.map((r) =>
          r.change > 0.5 ? "rgba(39,174,96,0.82)" : r.change < -0.5 ? "rgba(192,57,43,0.82)" : "rgba(149,165,166,0.65)",
        ),
      },
    ],
  };

  return (
    <div>
      <p className="text-muted mb-2" style={{ fontSize: ".8rem" }}>
        <i className="fas fa-info-circle" /> <span className="text-success">Hijau = bertambah</span> ·{" "}
        <span className="text-danger">Merah = berkurang</span> (nilai riil dari backend)
      </p>
      <div style={{ height: Math.max(280, rows.length * 32) }}>
        <Bar
          data={data}
          options={{
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.raw && Number(ctx.raw) > 0 ? "+" : ""}${ctx.formattedValue} ha`,
                },
              },
            },
            scales: {
              x: { title: { display: true, text: "Perubahan Luas (ha)" } },
            },
          }}
        />
      </div>
    </div>
  );
}
