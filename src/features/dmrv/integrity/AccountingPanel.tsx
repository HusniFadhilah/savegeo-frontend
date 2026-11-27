import { useState, type FormEvent } from "react";
import type { MonitoringPeriod, Project } from "../types";
import { newIdempotencyKey } from "../api";
import { saveRecord } from "./api";
import { EvidenceField, Field, RecordList, type SectionProps } from "./shared";
import { errorMessage, references, useCopy } from "./helpers";
import type { IntegrityRecord } from "./types";

const POOLS = ["AGB", "BGB", "SOC", "litter", "deadwood"];
const COLS = ["project_start", "project_end", "baseline_start", "baseline_end"];
type Stock = {
  pool: string;
  included: boolean;
  project_start: string;
  project_end: string;
  baseline_start: string;
  baseline_end: string;
};
const initialStocks = (): Stock[] =>
  POOLS.map((pool) => ({
    pool,
    included: true,
    project_start: "",
    project_end: "",
    baseline_start: "",
    baseline_end: "",
  }));

export default function AccountingPanel({
  project,
  periods,
  ...props
}: SectionProps & { project: Project; periods: MonitoringPeriod[] }) {
  const c = useCopy();
  const [current, setCurrent] = useState<IntegrityRecord | null>(null);
  const [stocks, setStocks] = useState(initialStocks);
  const [form, setForm] = useState({
    title: "",
    period_id: "",
    profile_reference: "",
    rule_justification: "",
    excluded_pools_reason: "",
    project_emissions_tco2e: "",
    leakage_tco2e: "",
    uncertainty_deduction_pct: "",
    buffer_pct: "",
    evidence: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  function edit(record: IntegrityRecord) {
    setCurrent(record);
    const p = record.payload;
    setForm({
      title: record.title,
      period_id: String(p.period_id || ""),
      profile_reference: String(p.profile_reference || ""),
      rule_justification: String(p.rule_justification || ""),
      excluded_pools_reason: String(p.excluded_pools_reason || ""),
      project_emissions_tco2e:
        p.project_emissions_tco2e == null ? "" : String(p.project_emissions_tco2e),
      leakage_tco2e: p.leakage_tco2e == null ? "" : String(p.leakage_tco2e),
      uncertainty_deduction_pct:
        p.uncertainty_deduction_pct == null ? "" : String(p.uncertainty_deduction_pct),
      buffer_pct: p.buffer_pct == null ? "" : String(p.buffer_pct),
      evidence: Array.isArray(p.evidence) ? p.evidence.join("\n") : "",
    });
    const input = (p.pools || []) as Record<string, string | number>[];
    setStocks(
      POOLS.map((pool) => {
        const item = input.find((r) => r.pool === pool);
        return {
          pool,
          included: Boolean(item),
          project_start: String(item?.project_start ?? ""),
          project_end: String(item?.project_end ?? ""),
          baseline_start: String(item?.baseline_start ?? ""),
          baseline_end: String(item?.baseline_end ?? ""),
        };
      }),
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const numeric = Object.fromEntries(
        ["project_emissions_tco2e", "leakage_tco2e", "uncertainty_deduction_pct", "buffer_pct"].map(
          (key) => [
            key,
            form[key as keyof typeof form] === "" ? null : Number(form[key as keyof typeof form]),
          ],
        ),
      );
      await saveRecord(
        props.projectId,
        "accounting",
        current?.record_key || newIdempotencyKey(),
        {
          title: form.title,
          status: "draft",
          payload: {
            ...numeric,
            period_id: form.period_id,
            methodology_id: project.methodology_id,
            methodology_version: project.methodology_version,
            profile_reference: form.profile_reference,
            rule_justification: form.rule_justification,
            excluded_pools_reason: form.excluded_pools_reason,
            evidence: references(form.evidence),
            pools: stocks
              .filter((s) => s.included)
              .map((s) => ({
                pool: s.pool,
                ...Object.fromEntries(COLS.map((key) => [key, Number(s[key as keyof Stock])])),
              })),
          },
        },
        current?.revision || 0,
      );
      await props.onChanged();
      setCurrent(null);
      setForm((old) => ({ ...old, title: "" }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  const labels = [
    c("Proyek awal", "Project start"),
    c("Proyek akhir", "Project end"),
    c("Baseline awal", "Baseline start"),
    c("Baseline akhir", "Baseline end"),
  ];
  return (
    <>
      <p className="integrity-note">
        {c(
          "Perhitungan perubahan stok dengan profil yang Anda dokumentasikan. Luas berasal dari versi batas periode monitoring. Hasil skenario perlu penilaian metodologi dan verifikasi sebelum dapat menjadi kredit.",
          "Stock-change calculation using your documented profile. Area comes from the monitoring period's boundary version. Scenario results require methodology assessment and verification before crediting.",
        )}
      </p>
      {props.canWrite ? (
        <form className="integrity-editor" onSubmit={(e) => void submit(e)}>
          <h3>
            {current
              ? c("Ubah perhitungan", "Edit calculation")
              : c("Perhitungan baru", "New calculation")}
          </h3>
          <div className="integrity-form-grid">
            <Field label={c("Nama perhitungan", "Calculation name")}>
              <input
                required
                maxLength={200}
                className="form-control"
                value={form.title}
                onChange={(e) => change("title", e.target.value)}
              />
            </Field>
            <Field label={c("Periode monitoring", "Monitoring period")}>
              <select
                required
                className="form-select"
                value={form.period_id}
                onChange={(e) => change("period_id", e.target.value)}
              >
                <option value="">{c("Pilih periode", "Select period")}</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · v{p.boundary_version}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="integrity-note">
            {c("Metodologi proyek", "Project methodology")}: {project.methodology_id || "—"} /{" "}
            {project.methodology_version ||
              c("versi belum diisi di Pengaturan", "set version in Settings")}
          </p>
          <div className="integrity-form-grid">
            <Field label={c("Sumber profil / aturan", "Profile / rule source")}>
              <input
                required
                type="url"
                className="form-control"
                value={form.profile_reference}
                onChange={(e) => change("profile_reference", e.target.value)}
              />
            </Field>
            <Field
              label={c(
                "Dasar penerapan aturan dan pengurangan",
                "Rule and deduction justification",
              )}
            >
              <textarea
                required
                minLength={10}
                rows={2}
                className="form-control"
                value={form.rule_justification}
                onChange={(e) => change("rule_justification", e.target.value)}
              />
            </Field>
          </div>
          <div className="table-responsive">
            <table className="table integrity-stock-table">
              <caption>
                {c(
                  "Semua stok dalam Mg C/ha. Konversikan biomassa kering ke karbon sebelum mengisi.",
                  "All stocks in Mg C/ha. Convert dry biomass to carbon before entering values.",
                )}
              </caption>
              <thead>
                <tr>
                  <th>{c("Pool karbon", "Carbon pool")}</th>
                  {labels.map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock, index) => (
                  <tr key={stock.pool}>
                    <td>
                      <label>
                        <input
                          type="checkbox"
                          checked={stock.included}
                          onChange={(e) =>
                            setStocks((old) =>
                              old.map((s, i) =>
                                i === index ? { ...s, included: e.target.checked } : s,
                              ),
                            )
                          }
                        />{" "}
                        {stock.pool}
                      </label>
                    </td>
                    {COLS.map((key, col) => (
                      <td key={key}>
                        <input
                          aria-label={`${stock.pool} ${labels[col]}`}
                          type="number"
                          min={0}
                          max={10000000}
                          step="any"
                          required={stock.included}
                          disabled={!stock.included}
                          className="form-control"
                          value={stock[key as keyof Stock] as string}
                          onChange={(e) =>
                            setStocks((old) =>
                              old.map((s, i) =>
                                i === index ? { ...s, [key]: e.target.value } : s,
                              ),
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stocks.some((s) => !s.included) ? (
            <Field label={c("Alasan pool dikecualikan", "Reason for excluded pools")}>
              <textarea
                required
                className="form-control"
                value={form.excluded_pools_reason}
                onChange={(e) => change("excluded_pools_reason", e.target.value)}
              />
            </Field>
          ) : null}
          <div className="integrity-form-grid">
            {(
              [
                ["project_emissions_tco2e", c("Emisi proyek (tCO₂e)", "Project emissions (tCO₂e)")],
                ["leakage_tco2e", "Leakage (tCO₂e)"],
                [
                  "uncertainty_deduction_pct",
                  c("Pengurangan ketidakpastian (%)", "Uncertainty deduction (%)"),
                ],
                ["buffer_pct", c("Cadangan buffer (%)", "Buffer reserve (%)")],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                hint={c(
                  "Kosong berarti belum diketahui; nol harus didukung bukti.",
                  "Blank means unknown; zero needs evidence.",
                )}
              >
                <input
                  type="number"
                  min={0}
                  max={key.endsWith("pct") ? 100 : 1e12}
                  step="any"
                  className="form-control"
                  value={form[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              </Field>
            ))}
          </div>
          <EvidenceField value={form.evidence} onChange={(s) => change("evidence", s)} />
          <div className="integrity-actions">
            <button
              type="submit"
              className="btn btn-success"
              disabled={busy || !periods.length || !project.methodology_version}
            >
              {busy
                ? c("Menghitung…", "Calculating…")
                : c("Hitung dan simpan draft", "Calculate and save draft")}
            </button>
            {current ? (
              <button
                type="button"
                className="btn btn-light"
                onClick={() => {
                  setCurrent(null);
                  setStocks(initialStocks());
                }}
              >
                {c("Perhitungan baru", "New calculation")}
              </button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      <RecordList {...props} onEdit={edit} />
    </>
  );
}
