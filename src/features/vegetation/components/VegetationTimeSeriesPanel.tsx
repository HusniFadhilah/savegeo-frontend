import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { VegetationTimeSeriesResponse } from "@/features/vegetation/types";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

interface Props {
  result: VegetationTimeSeriesResponse;
}

/**
 * P0 "time-series & timelapse" for vegetation: monthly index values across
 * one year, from POST /timeseries (existed in the backend but was never
 * called by any frontend caller until now).
 */
export default function VegetationTimeSeriesPanel({ result }: Props) {
  const points = result.data.filter((p) => p.value != null);
  const hasData = points.length > 0;

  return (
    <div className="card mt-3">
      <div className="card-header">
        <i className="bi bi-graph-up me-1" /> Time-Series Bulanan {result.index} ({result.year})
      </div>
      <div className="card-body">
        {!hasData && (
          <div className="alert alert-warning py-2 mb-0" style={{ fontSize: ".85rem" }}>
            Tidak ada citra bebas awan yang cukup di bulan manapun tahun ini untuk AOI/threshold ini.
          </div>
        )}
        {hasData && (
          <>
            <div style={{ height: 300 }}>
              <Line
                data={{
                  labels: result.data.map((p) => p.period.slice(5)),
                  datasets: [
                    {
                      label: result.index,
                      data: result.data.map((p) => p.value),
                      borderColor: "#2e7d32",
                      backgroundColor: "#2e7d3255",
                      spanGaps: true,
                      tension: 0.25,
                      pointRadius: 3,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { title: { display: true, text: "Bulan" } },
                    y: { title: { display: true, text: result.index } },
                  },
                }}
              />
            </div>
            {result.satellite && (
              <small className="text-muted d-block mt-2">
                Citra dari <strong>{result.satellite.name}</strong> ({result.satellite.provider}) · skala {result.scale}m
              </small>
            )}
          </>
        )}
      </div>
    </div>
  );
}
