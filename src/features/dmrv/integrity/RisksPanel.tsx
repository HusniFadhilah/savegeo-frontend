import { useEffect, useRef, useState, type FormEvent } from "react";
import { listDmrvJobs, newIdempotencyKey } from "../api";
import type { DmrvJob } from "../types";
import { queueRiskScan, saveRecord, saveRiskPolicy } from "./api";
import { EvidenceField, Field, RecordList, type SectionProps } from "./shared";
import { errorMessage, references, useCopy } from "./helpers";
import type { RiskPolicy } from "./types";

export function IssueForm({
  category,
  ...props
}: SectionProps & { category: "risk" | "grievance" }) {
  const c = useCopy();
  const [form, setForm] = useState({
    title: "",
    summary: "",
    owner: "",
    due_date: "",
    date: "",
    severity: "medium",
    signal: "field_report",
    topic: "other",
    evidence: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        summary: form.summary,
        evidence: references(form.evidence),
        owner: form.owner,
        due_date: form.due_date || null,
        severity: form.severity,
        ...(category === "risk"
          ? { signal: form.signal, observed_on: form.date, affected_area_ha: null }
          : { topic: form.topic, received_on: form.date }),
      };
      await saveRecord(
        props.projectId,
        category,
        newIdempotencyKey(),
        { title: form.title, payload, status: "open" },
        0,
      );
      await props.onChanged();
      setForm((old) => ({ ...old, title: "", summary: "" }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {props.canWrite ? (
        <details className="integrity-editor">
          <summary>
            {category === "risk"
              ? c("Catat risiko lapangan", "Record a field risk")
              : c("Catat pengaduan dan tindak lanjut", "Record a grievance and follow-up")}
          </summary>
          <form onSubmit={(e) => void submit(e)}>
            {category === "grievance" ? (
              <p className="integrity-note">
                {c(
                  "Gunakan kode kasus. Hindari identitas pribadi atau data sensitif pelapor dalam ringkasan.",
                  "Use a case code. Avoid complainant identities or sensitive personal details in the summary.",
                )}
              </p>
            ) : null}
            <div className="integrity-form-grid">
              <Field label={c("Judul / kode kasus", "Title / case code")}>
                <input
                  required
                  className="form-control"
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => change("title", e.target.value)}
                />
              </Field>
              <Field label={c("Tanggal pengamatan / diterima", "Observation / received date")}>
                <input
                  required
                  type="date"
                  className="form-control"
                  value={form.date}
                  onChange={(e) => change("date", e.target.value)}
                />
              </Field>
              <Field label={c("Tingkat risiko", "Severity")}>
                <select
                  className="form-select"
                  value={form.severity}
                  onChange={(e) => change("severity", e.target.value)}
                >
                  <option value="low">{c("Rendah", "Low")}</option>
                  <option value="medium">{c("Sedang", "Medium")}</option>
                  <option value="high">{c("Tinggi", "High")}</option>
                </select>
              </Field>
              {category === "grievance" ? (
                <Field label={c("Topik", "Topic")}>
                  <select
                    className="form-select"
                    value={form.topic}
                    onChange={(e) => change("topic", e.target.value)}
                  >
                    <option value="consent">FPIC</option>
                    <option value="benefit_sharing">
                      {c("Pembagian manfaat", "Benefit sharing")}
                    </option>
                    <option value="access">{c("Akses lahan", "Land access")}</option>
                    <option value="other">{c("Lainnya", "Other")}</option>
                  </select>
                </Field>
              ) : null}
              <Field label={c("Penanggung jawab", "Responsible team")}>
                <input
                  maxLength={100}
                  className="form-control"
                  value={form.owner}
                  onChange={(e) => change("owner", e.target.value)}
                />
              </Field>
              <Field label={c("Target selesai", "Due date")}>
                <input
                  type="date"
                  className="form-control"
                  value={form.due_date}
                  onChange={(e) => change("due_date", e.target.value)}
                />
              </Field>
            </div>
            <Field label={c("Ringkasan", "Summary")}>
              <textarea
                required
                maxLength={8000}
                rows={3}
                className="form-control"
                value={form.summary}
                onChange={(e) => change("summary", e.target.value)}
              />
            </Field>
            <EvidenceField value={form.evidence} onChange={(s) => change("evidence", s)} />
            <button type="submit" className="btn btn-success" disabled={busy}>
              {c("Simpan catatan", "Save record")}
            </button>
            {error ? (
              <p role="alert" className="text-danger">
                {error}
              </p>
            ) : null}
          </form>
        </details>
      ) : null}
      <RecordList {...props} records={props.records.filter((r) => r.category === category)} />
    </>
  );
}

export default function RisksPanel({ policy, ...props }: SectionProps & { policy: RiskPolicy }) {
  const c = useCopy();
  const [form, setForm] = useState(policy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<DmrvJob[]>([]);
  const [tick, setTick] = useState(0);
  const previouslyActive = useRef(false);
  const { projectId, onChanged } = props;
  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const rows = (await listDmrvJobs(projectId)).filter(
          (j) => j.kind === "integrity_risk_scan",
        );
        if (!active) return;
        setJobs(rows);
        const pending = rows.some((j) => ["queued", "running"].includes(j.status));
        if (previouslyActive.current && !pending) await onChanged();
        previouslyActive.current = pending;
        if (pending && active) timeout = setTimeout(() => void poll(), 5000);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      }
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [projectId, onChanged, tick]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await saveRiskPolicy(projectId, form);
      await onChanged();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function scan() {
    setBusy(true);
    setError("");
    try {
      await queueRiskScan(projectId, newIdempotencyKey());
      previouslyActive.current = true;
      setTick((n) => n + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="integrity-note">
        {c(
          "Bandingkan dua jendela waktu Dynamic World dan periksa sel termal FIRMS. Temuan adalah sinyal untuk review; luas terbakar atau kehilangan karbon belum dihitung. Jadwal berjalan saat worker dMRV aktif.",
          "Compare two Dynamic World time windows and screen FIRMS thermal cells. Findings are review signals; burned area and carbon loss are not calculated. Schedules run while the dMRV worker is active.",
        )}
      </p>
      {props.canWrite ? (
        <form className="integrity-editor" onSubmit={(e) => void save(e)}>
          <h3>{c("Jadwal dan ambang monitoring", "Monitoring schedule and thresholds")}</h3>
          <label className="integrity-toggle">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
            />
            {c("Aktifkan pemeriksaan berkala", "Enable scheduled checks")}
          </label>
          <div className="integrity-form-grid">
            {(
              [
                ["interval_days", c("Interval pemeriksaan (hari)", "Check interval (days)"), 1, 90],
                [
                  "lookback_days",
                  c("Panjang setiap jendela (hari)", "Length of each window (days)"),
                  7,
                  90,
                ],
                [
                  "tree_loss_threshold_ha",
                  c("Ambang indikasi perubahan pohon (ha)", "Potential tree change threshold (ha)"),
                  0.01,
                  500000,
                ],
                [
                  "min_observations",
                  c("Observasi minimum per piksel", "Minimum observations per pixel"),
                  1,
                  30,
                ],
              ] as const
            ).map(([key, label, min, max]) => (
              <Field key={key} label={label}>
                <input
                  required
                  type="number"
                  min={min}
                  max={max}
                  step={key === "tree_loss_threshold_ha" ? "any" : 1}
                  className="form-control"
                  value={form[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
                />
              </Field>
            ))}
          </div>
          <div className="integrity-actions">
            <button type="submit" className="btn btn-success" disabled={busy}>
              {c("Simpan jadwal", "Save schedule")}
            </button>
            <button
              type="button"
              className="btn btn-outline-success"
              disabled={busy || jobs.some((j) => ["queued", "running"].includes(j.status))}
              onClick={() => void scan()}
            >
              {c("Periksa sekarang", "Check now")}
            </button>
          </div>
          {policy.next_run_at ? (
            <p className="integrity-note">
              {c("Jadwal berikutnya", "Next scheduled check")}:{" "}
              {new Date(policy.next_run_at).toLocaleString()}
            </p>
          ) : null}
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      ) : null}
      {jobs.length ? (
        <div className="integrity-job-list" aria-live="polite">
          {jobs.slice(0, 5).map((job) => (
            <p key={job.id}>
              {new Date(job.created_at || "").toLocaleString()} · <strong>{job.status}</strong>
              {job.error ? ` · ${job.error.message}` : ""}
            </p>
          ))}
        </div>
      ) : null}
      <IssueForm {...props} category="risk" />
      <details className="integrity-editor">
        <summary>{c("Riwayat pemeriksaan satelit", "Satellite screening history")}</summary>
        <RecordList {...props} records={props.records.filter((r) => r.category === "scan")} />
      </details>
    </>
  );
}
