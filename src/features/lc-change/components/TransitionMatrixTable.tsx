import type { CSSProperties } from "react";
import type { TransitionData } from "../types";
import { translateLulcClass } from "../utils";

interface Props {
  trans: TransitionData;
  yearA: number;
  yearB: number;
}

/**
 * Transition matrix as a color-scaled HTML table (rows = origin class @ yearA,
 * columns = destination class @ yearB, diagonal = persistent area). Replaces
 * the legacy Plotly heatmap (`_renderMatrix`) - Plotly isn't part of this
 * app's dependency set, only chart.js/react-chartjs-2, and chart.js has no
 * built-in heatmap type. A colored table conveys the same rows/cols/diagonal
 * reading and keeps this module dependency-free beyond what's installed.
 */
export default function TransitionMatrixTable({ trans, yearA, yearB }: Props) {
  const { matrix, allClasses } = trans;
  const maxVal = Math.max(1, ...allClasses.flatMap((f) => allClasses.map((t) => matrix[f]?.[t] || 0)));

  const cellStyle = (from: string, to: string): CSSProperties => {
    const v = matrix[from]?.[to] || 0;
    const ratio = v / maxVal;
    const isDiagonal = from === to;
    return {
      backgroundColor: `rgba(33, 113, 181, ${Math.min(0.08 + ratio * 0.85, 0.93)})`,
      color: ratio > 0.55 ? "#fff" : "#1f2937",
      fontWeight: isDiagonal ? 700 : 400,
      border: isDiagonal ? "2px solid #084594" : "1px solid rgba(0,0,0,0.06)",
      textAlign: "center",
      padding: "6px 8px",
      fontSize: ".78rem",
      whiteSpace: "nowrap",
    };
  };

  return (
    <div>
      <p className="text-muted mb-2" style={{ fontSize: ".8rem" }}>
        <i className="fas fa-info-circle" /> Baris = kelas asal ({yearA}) · Kolom = kelas tujuan ({yearB}) ·
        Diagonal (kotak tebal) = area tidak berubah
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="table table-sm table-bordered mb-0" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ background: "transparent", border: "none" }} />
              {allClasses.map((c) => (
                <th key={c} className="text-center small text-muted" style={{ writingMode: "horizontal-tb" }}>
                  → {translateLulcClass(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allClasses.map((from) => (
              <tr key={from}>
                <th className="small text-muted text-nowrap align-middle">{translateLulcClass(from)} →</th>
                {allClasses.map((to) => {
                  const v = matrix[from]?.[to] || 0;
                  return (
                    <td key={to} style={cellStyle(from, to)} title={`${translateLulcClass(from)} → ${translateLulcClass(to)}`}>
                      {v >= 1 ? v.toLocaleString("id-ID", { maximumFractionDigits: 0 }) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-muted mt-2" style={{ fontSize: ".78rem" }}>
        Nilai dalam hektar (ha). Warna lebih pekat = luas transisi lebih besar.
      </div>
    </div>
  );
}
