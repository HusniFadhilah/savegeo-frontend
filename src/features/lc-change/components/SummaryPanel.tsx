import type { LcClassInfo, LcDataset, TransitionData } from "../types";
import { colorForClass, fmtHa, translateLulcClass } from "../utils";
import type { LcYearResult } from "../types";

interface Props {
  trans: TransitionData;
  clsA: Record<string, LcClassInfo>;
  dataset: LcDataset;
  yearData: Record<number, LcYearResult>;
}

function makeRows(
  entries: [string, number][],
  sign: string,
  cssClass: string,
  totalAreaA: number,
  dataset: LcDataset,
  yearData: Record<number, LcYearResult>,
) {
  if (!entries.length) {
    return (
      <tr>
        <td colSpan={3} className="text-muted fst-italic">
          —
        </td>
      </tr>
    );
  }
  return [...entries]
    .sort((a, b) => b[1] - a[1])
    .map(([cls, val]) => (
      <tr key={cls}>
        <td>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              background: colorForClass(cls, dataset, yearData),
              borderRadius: 2,
              marginRight: 5,
            }}
          />
          {translateLulcClass(cls)}
        </td>
        <td className={`${cssClass} fw-bold`}>
          {sign}
          {fmtHa(val)} ha
        </td>
        <td className="text-muted">{((val / totalAreaA) * 100).toFixed(1)}%</td>
      </tr>
    ));
}

/** Ports LCChange._renderSummaryTable: gain/loss class breakdown + biggest single transition insight. */
export default function SummaryPanel({ trans, clsA, dataset, yearData }: Props) {
  const { gains, losses, matrix, allClasses } = trans;
  const totalAreaA = Object.values(clsA).reduce((s, c) => s + Number(c.area || 0), 0) || 1;

  let bigFrom = "";
  let bigTo = "";
  let bigVal = 0;
  allClasses.forEach((f) => {
    allClasses.forEach((t) => {
      if (f !== t && (matrix[f]?.[t] || 0) > bigVal) {
        bigVal = matrix[f][t];
        bigFrom = f;
        bigTo = t;
      }
    });
  });

  return (
    <div>
      <div className="row">
        <div className="col-md-6">
          <h6 className="text-success mb-2">
            <i className="fas fa-arrow-up" /> Kelas Bertambah
          </h6>
          <table className="table table-sm table-hover mb-0">
            <thead className="table-success">
              <tr>
                <th>Kelas</th>
                <th>Perubahan</th>
                <th>% Total</th>
              </tr>
            </thead>
            <tbody>{makeRows(Object.entries(gains), "+", "text-success", totalAreaA, dataset, yearData)}</tbody>
          </table>
        </div>
        <div className="col-md-6">
          <h6 className="text-danger mb-2">
            <i className="fas fa-arrow-down" /> Kelas Berkurang
          </h6>
          <table className="table table-sm table-hover mb-0">
            <thead className="table-danger">
              <tr>
                <th>Kelas</th>
                <th>Perubahan</th>
                <th>% Total</th>
              </tr>
            </thead>
            <tbody>{makeRows(Object.entries(losses), "−", "text-danger", totalAreaA, dataset, yearData)}</tbody>
          </table>
        </div>
      </div>
      {bigVal > 0.5 && (
        <div className="alert alert-secondary mt-3 py-2" style={{ fontSize: ".85rem" }}>
          <i className="fas fa-lightbulb text-warning" /> <strong>Transisi terbesar (estimasi):</strong>{" "}
          {translateLulcClass(bigFrom)} → {translateLulcClass(bigTo)}: <strong>{fmtHa(bigVal)} ha</strong>
        </div>
      )}
    </div>
  );
}
