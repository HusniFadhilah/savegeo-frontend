import { Bar } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import type { LcClassInfo, TransitionData } from "../types";
import { translateLulcClass } from "../utils";
import { useI18nStore } from "@/hooks/useI18nStore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  clsA: Record<string, LcClassInfo>;
  clsB: Record<string, LcClassInfo>;
  trans?: TransitionData | null;
}

/** Horizontal net-change bar chart, ported from LCChange._renderNetChange (Plotly -> chart.js). */
export default function NetChangeChart({ clsA, clsB, trans }: Props) {
  const t = useI18nStore((state) => state.t);
  if (!trans) return <p className="text-muted small">{t("lc.netChange.requiresTransition")}</p>;
  const all = [...new Set([...Object.keys(clsA), ...Object.keys(clsB)])];
  const rows = all
    .map((cls) => ({
      cls,
      change: Number(trans.gains[cls] || 0) - Number(trans.losses[cls] || 0),
    }))
    .sort((a, b) => a.change - b.change);

  if (!rows.length) return <p className="text-muted small">{t("lc.netChange.noData")}</p>;

  const data = {
    labels: rows.map((r) => translateLulcClass(r.cls)),
    datasets: [
      {
        label: t("lc.netChange.areaChange"),
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
        <i className="fas fa-info-circle" /> <span className="text-success">{t("lc.netChange.increaseColor")}</span> ·{" "}
        <span className="text-danger">{t("lc.netChange.decreaseColor")}</span> ({t("lc.netChange.backendValues")})
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
                  x: { title: { display: true, text: t("lc.netChange.areaChange") } },
            },
          }}
        />
      </div>
    </div>
  );
}
