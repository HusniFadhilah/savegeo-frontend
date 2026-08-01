import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { LcDataset, LcYearResult } from "../types";
import { colorForClass, hexRgba, translateLulcClass } from "../utils";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip, Legend);

interface Props {
  years: number[];
  yearData: Record<number, LcYearResult>;
  dataset: LcDataset;
}

/** Stacked-area class evolution across all analyzed years, ported from LCChange._renderTimeSeries. */
export default function TimeSeriesChart({ years, yearData, dataset }: Props) {
  const allClasses = new Set<string>();
  years.forEach((y) => Object.keys(yearData[y]?.classes || {}).forEach((c) => allClasses.add(c)));

  const totals = years.map((y) => Number(yearData[y]?.total_area_ha || 0));
  const positive = totals.filter((v) => v > 0);
  const minTotal = positive.length ? Math.min(...positive) : 0;
  const maxTotal = positive.length ? Math.max(...positive) : 0;
  const areaVarianceHigh = minTotal > 0 && maxTotal / minTotal > 1.1;

  const datasets = [...allClasses].map((cls) => {
    const color = colorForClass(cls, dataset, yearData);
    return {
      label: translateLulcClass(cls),
      data: years.map((y) => Number((yearData[y]?.classes?.[cls]?.area || 0).toFixed(1))),
      borderColor: color,
      backgroundColor: hexRgba(color, 0.55),
      fill: true,
      stack: "lc",
      tension: 0.15,
      pointRadius: 2.5,
    };
  });

  return (
    <div>
      <p className="text-muted mb-2" style={{ fontSize: ".8rem" }}>
        <i className="fas fa-info-circle" /> Area stacked seluruh tahun yang dianalisis · Hover untuk detail tiap
        kelas
      </p>
      {areaVarianceHigh && (
        <div className="alert alert-warning py-1 px-2 mb-2" style={{ fontSize: ".78rem" }}>
          Catatan: total area antar tahun berbeda &gt;10%; cek cakupan dataset/AOI.
        </div>
      )}
      <div style={{ height: 420 }}>
        <Line
          data={{ labels: years, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "bottom" },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue} ha`,
                },
              },
            },
            scales: {
              x: { title: { display: true, text: "Tahun" } },
              y: { stacked: true, title: { display: true, text: "Luas (ha)" } },
            },
          }}
        />
      </div>
    </div>
  );
}
