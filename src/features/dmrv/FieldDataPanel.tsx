import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";
import { commitFieldImport, listPlots, listVisits, newIdempotencyKey, previewFieldImport } from "./api";
import { describeDmrvError } from "./errors";
import FieldSummaryJobPanel from "./FieldSummaryJobPanel";
import type { ImportPreview, ImportResult, Plot, RowIssue, Visit } from "./types";

const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

function IssueTable({ issues, label }: { issues: RowIssue[]; label: string }) {
  const t = useI18nStore((s) => s.t);
  if (issues.length === 0) return null;
  return (
    <table className="table table-sm" aria-label={label}>
      <thead>
        <tr>
          <th scope="col">{t("dmrv.field.row")}</th>
          <th scope="col">{t("dmrv.field.level")}</th>
          <th scope="col">{t("dmrv.field.code")}</th>
          <th scope="col">{t("dmrv.field.message")}</th>
        </tr>
      </thead>
      <tbody>
        {issues.map((issue, index) => (
          <tr key={`${issue.row}-${issue.code}-${index}`} className={issue.level === "error" ? "table-danger" : "table-warning"}>
            <td>{issue.row}</td>
            <td>{issue.level}</td>
            <td><code>{issue.code}</code></td>
            <td>{issue.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function FieldDataPanel({ projectId, canWrite, canRunSummary = false }: { projectId: string; canWrite: boolean; canRunSummary?: boolean }) {
  const t = useI18nStore((s) => s.t);
  const language = useI18nStore((s) => s.language);
  const [plots, setPlots] = useState<Plot[] | null>(null);
  const [visits, setVisits] = useState<Record<string, Visit[]>>({});
  const [file, setFile] = useState<File | null>(null);
  const [heightUnit, setHeightUnit] = useState<"m" | "cm">("m");
  const [plotArea, setPlotArea] = useState("");
  const [areaBasis, setAreaBasis] = useState<"assumed" | "measured">("assumed");
  const [mode, setMode] = useState<"atomic" | "partial">("atomic");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "import">("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  const loadPlots = useCallback(async () => {
    try {
      setPlots(await listPlots(projectId));
    } catch (cause) {
      setError(describeDmrvError(cause, t));
      setPlots([]);
    }
  }, [projectId, t]);

  useEffect(() => { void loadPlots(); }, [loadPlots]);

  const invalidate = () => { setPreview(null); setResult(null); };

  function buildForm(): FormData | null {
    if (!file) return null;
    const form = new FormData();
    form.append("file", file);
    form.append("mode", mode);
    form.append("height_unit", heightUnit);
    form.append("area_basis", areaBasis);
    if (plotArea.trim()) form.append("plot_area_m2", plotArea.trim());
    return form;
  }

  async function run(kind: "preview" | "import", action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(kind); setError("");
    try {
      await action();
    } catch (cause) {
      setError(describeDmrvError(cause, t));
    } finally {
      inFlight.current = false;
      setBusy("");
    }
  }

  const onPreview = (event: FormEvent) => {
    event.preventDefault();
    const form = buildForm();
    if (!form) return;
    void run("preview", async () => {
      setResult(null);
      setPreview(await previewFieldImport(projectId, form));
    });
  };

  const onImport = () => {
    const form = buildForm();
    if (!form || !file || !preview || preview.report.rows_total === 0) return;
    // The same file + options retried after a lost response reuse their key (no duplicate batch).
    const signature = [file.name, file.size, file.lastModified, mode, heightUnit, plotArea, areaBasis].join("|");
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: newIdempotencyKey() };
    const key = attempt.current.key;
    void run("import", async () => {
      setResult(await commitFieldImport(projectId, form, key));
      attempt.current = null;
      setPreview(null); // preview again (against the new state) before another import
      await loadPlots();
    });
  };

  async function showVisits(plotCode: string) {
    try {
      const rows = await listVisits(projectId, plotCode);
      setVisits((current) => ({ ...current, [plotCode]: rows }));
    } catch (cause) {
      setError(describeDmrvError(cause, t));
    }
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => { setFile(event.target.files?.[0] ?? null); invalidate(); };
  const canImport = Boolean(preview && preview.report.rows_total > 0) && busy === "";

  return (
    <section aria-labelledby="dmrv-field-heading" className="px-1">
      <h2 id="dmrv-field-heading" className="h5">{t("dmrv.field.heading")}</h2>

      <FieldSummaryJobPanel projectId={projectId} canRun={canRunSummary} />

      {!canWrite && <p className="text-muted">{t("dmrv.field.readOnly")}</p>}
      {canWrite && (
        <form className="card card-body mb-4" onSubmit={onPreview}>
          <div className="mb-3">
            <label className="form-label" htmlFor="dmrv-field-file">{t("dmrv.field.file")}</label>
            <input id="dmrv-field-file" type="file" accept=".csv,.xlsx" className="form-control" onChange={onFile} />
          </div>
          <div className="row">
            <div className="col-md-3 mb-3">
              <label className="form-label" htmlFor="dmrv-field-height">{t("dmrv.field.heightUnit")}</label>
              <select id="dmrv-field-height" className="form-select" value={heightUnit} onChange={(e) => { setHeightUnit(e.target.value as "m" | "cm"); invalidate(); }}>
                <option value="m">{t("dmrv.field.unit.m")}</option>
                <option value="cm">{t("dmrv.field.unit.cm")}</option>
              </select>
            </div>
            <div className="col-md-3 mb-3">
              <label className="form-label" htmlFor="dmrv-field-area">{t("dmrv.field.plotArea")}</label>
              <input id="dmrv-field-area" className="form-control" inputMode="decimal" value={plotArea} onChange={(e) => { setPlotArea(e.target.value); invalidate(); }} />
            </div>
            <div className="col-md-3 mb-3">
              <label className="form-label" htmlFor="dmrv-field-basis">{t("dmrv.field.areaBasis")}</label>
              <select id="dmrv-field-basis" className="form-select" value={areaBasis} onChange={(e) => { setAreaBasis(e.target.value as "assumed" | "measured"); invalidate(); }}>
                <option value="assumed">{t("dmrv.field.basis.assumed")}</option>
                <option value="measured">{t("dmrv.field.basis.measured")}</option>
              </select>
            </div>
            <div className="col-md-3 mb-3">
              <label className="form-label" htmlFor="dmrv-field-mode">{t("dmrv.field.mode")}</label>
              <select id="dmrv-field-mode" className="form-select" value={mode} onChange={(e) => { setMode(e.target.value as "atomic" | "partial"); invalidate(); }}>
                <option value="atomic">{t("dmrv.field.mode.atomic")}</option>
                <option value="partial">{t("dmrv.field.mode.partial")}</option>
              </select>
            </div>
          </div>

          {error && <div role="alert" className="alert alert-danger">{error}</div>}

          {preview && (
            <div className="mb-3">
              <p className="mb-1">
                {t("dmrv.field.counts", { total: preview.report.rows_total, errors: preview.report.errors, warnings: preview.report.warnings })}
              </p>
              <h3 className="h6">{t("dmrv.field.mapping")}</h3>
              <ul className="list-unstyled small">
                {Object.entries(preview.suggested_mapping).map(([field, column]) => (
                  <li key={field}><code>{field}</code> ← {column}</li>
                ))}
              </ul>
              <IssueTable issues={preview.report.issues} label={t("dmrv.field.issues")} />
            </div>
          )}
          {result && (
            <div role="status" className={`alert ${result.status === "rejected" ? "alert-warning" : "alert-success"}`}>
              {t("dmrv.field.result", { status: t(`dmrv.field.status.${result.status}`), imported: result.rows_imported, rejected: result.rows_rejected })}
            </div>
          )}
          {!preview && file && <p className="text-muted small">{t("dmrv.field.noPreview")}</p>}

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-outline-primary" disabled={!file || busy !== ""}>
              {busy === "preview" ? t("dmrv.field.previewing") : t("dmrv.field.preview")}
            </button>
            <button type="button" className="btn btn-primary" disabled={!canImport} onClick={onImport}>
              {busy === "import" ? t("dmrv.field.importing") : t("dmrv.field.import")}
            </button>
          </div>
        </form>
      )}

      <h3 className="h6">{t("dmrv.field.plots")}</h3>
      {plots === null && <p role="status">{t("dmrv.loading")}</p>}
      {plots !== null && plots.length === 0 && <p>{t("dmrv.field.empty")}</p>}
      {plots !== null && plots.length > 0 && (
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th scope="col">{t("dmrv.field.plotCode")}</th>
              <th scope="col">{t("dmrv.field.plotArea.col")}</th>
              <th scope="col">{t("dmrv.field.visits")}</th>
              <th scope="col"><span className="visually-hidden">{t("dmrv.field.showVisits")}</span></th>
            </tr>
          </thead>
          <tbody>
            {plots.map((row) => (
              <tr key={row.plot_code}>
                <td>{row.plot_code}</td>
                <td>
                  {row.area_m2 === null ? "-" : formatNumber(row.area_m2, language)}
                  {row.area_basis && <small className="text-muted"> ({t(`dmrv.field.basis.${row.area_basis}`)})</small>}
                </td>
                <td>{row.visit_count}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void showVisits(row.plot_code)}>
                    {t("dmrv.field.showVisits")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {Object.entries(visits).map(([plotCode, rows]) => (
        <div key={plotCode} className="mb-3">
          <h4 className="h6">{t("dmrv.field.plotCode")} {plotCode}</h4>
          <ul className="list-group">
            {rows.map((row) => (
              <li key={row.visit_date} className="list-group-item">
                <strong>{row.date_precision === "year" ? `${row.visit_date.slice(0, 4)} (${t("dmrv.field.yearOnly")})` : row.visit_date}</strong>
                {" · "}{t("dmrv.field.trees")}: {row.tree_count}
                <div>
                  {t("dmrv.field.density")}:{" "}
                  {row.density.carbon_mg_c_per_ha === null
                    ? row.density.blockers.map((code) => <span key={code} className="text-danger">{t(`dmrv.field.blocker.${code}`)}</span>)
                    : <span>{`${formatNumber(row.density.carbon_mg_c_per_ha, language, TWO_DECIMALS)} ${t("dmrv.field.densityUnit")}`}</span>}
                </div>
                {row.density.trees_excluded > 0 && (
                  <small className="text-muted d-block">{t("dmrv.field.excluded", { count: row.density.trees_excluded })}</small>
                )}
                {row.density.area_basis && (
                  <small className="text-muted d-block">
                    <span>{t("dmrv.field.basisLabel", { basis: t(`dmrv.field.basis.${row.density.area_basis}`) })}</span>
                    {" · "}
                    <span>{t("dmrv.field.source")}</span>
                  </small>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
