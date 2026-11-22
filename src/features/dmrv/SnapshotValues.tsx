import { useState } from "react";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";
import { asRecord } from "./snapshotPresentation";

function Scalar({ value }: { value: unknown }) {
  const language = useI18nStore((s) => s.language);
  if (value === null || value === undefined)
    return (
      <span className="text-body-secondary">
        {language === "en" ? "Unavailable" : "Tidak tersedia"}
      </span>
    );
  if (typeof value === "number")
    return <>{formatNumber(value, language, { maximumFractionDigits: 6 })}</>;
  if (typeof value === "boolean")
    return <>{value ? (language === "en" ? "Yes" : "Ya") : language === "en" ? "No" : "Tidak"}</>;
  return <span className="text-break">{String(value)}</span>;
}
const simple = (value: unknown) => value === null || typeof value !== "object";
const title = (key: string) => key.replace(/_/g, " ");

/** Bounded presentation of the stored provider payload; never computes scientific values. */
export default function SnapshotValues({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const language = useI18nStore((s) => s.language);
  const en = language === "en";
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  if (simple(value)) return <Scalar value={value} />;
  if (depth >= 8)
    return (
      <pre className="small text-body overflow-auto" style={{ maxHeight: 280 }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  if (Array.isArray(value)) {
    if (!value.length)
      return <p className="text-body-secondary mb-0">{en ? "No entries" : "Tidak ada entri"}</p>;
    const records = value.every(
      (item) =>
        Object.keys(asRecord(item)).length > 0 && Object.values(asRecord(item)).every(simple),
    );
    const columns = records
      ? [...new Set(value.flatMap((item) => Object.keys(asRecord(item))))]
      : [];
    const filtered = value
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          !filter || JSON.stringify(item).toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
      );
    const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
    const rows = filtered.slice(currentPage * 20, currentPage * 20 + 20);
    return (
      <div>
        {value.length > 20 && (
          <input
            type="search"
            className="form-control form-control-sm my-2"
            aria-label={en ? "Filter saved rows" : "Cari baris tersimpan"}
            value={filter}
            placeholder={en ? "Search" : "Cari"}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(0);
            }}
          />
        )}
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-2">
            <thead>
              <tr>
                <th scope="col" style={{ width: "4rem" }}>
                  No
                </th>
                {records ? (
                  columns.map((key) => (
                    <th scope="col" key={key}>
                      {title(key)}
                    </th>
                  ))
                ) : (
                  <th scope="col">{en ? "Value" : "Nilai"}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, index }) => (
                <tr key={index}>
                  <th scope="row">{index + 1}</th>
                  {records ? (
                    columns.map((key) => (
                      <td key={key}>
                        <Scalar value={asRecord(item)[key]} />
                      </td>
                    ))
                  ) : (
                    <td>
                      <SnapshotValues value={item} depth={depth + 1} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p role="status">{en ? "No matching rows" : "Tidak ada baris yang cocok"}</p>
        )}
        {filtered.length > 20 && (
          <nav
            className="d-flex justify-content-between align-items-center gap-2"
            aria-label={en ? "Saved rows pages" : "Halaman baris tersimpan"}
          >
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              {en ? "Previous" : "Sebelumnya"}
            </button>
            <span className="small">
              {currentPage + 1} / {Math.ceil(filtered.length / 20)}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              disabled={(currentPage + 1) * 20 >= filtered.length}
              onClick={() => setPage(currentPage + 1)}
            >
              {en ? "Next" : "Berikutnya"}
            </button>
          </nav>
        )}
      </div>
    );
  }
  const entries = Object.entries(asRecord(value));
  return (
    <dl className="row g-2 mb-0 mt-1">
      {entries.map(([key, child]) =>
        simple(child) ? (
          <div className="col-md-6" key={key}>
            <dt className="small text-body-secondary fw-normal">{title(key)}</dt>
            <dd className="mb-1">
              <Scalar value={child} />
            </dd>
          </div>
        ) : (
          <div className="col-12" key={key}>
            <details className="border rounded p-2">
              <summary>{title(key)}</summary>
              <SnapshotValues value={child} depth={depth + 1} />
            </details>
          </div>
        ),
      )}
    </dl>
  );
}
