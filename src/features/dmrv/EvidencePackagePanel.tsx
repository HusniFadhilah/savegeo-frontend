import { useCallback, useEffect, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import { env } from "@/config/env";
import { describeDmrvError } from "./errors";
import {
  createEvidencePackage,
  evidencePackageDownloadPath,
  listDmrvJobs,
  listEvidencePackages,
  newIdempotencyKey,
  verifyEvidencePackage,
} from "./api";
import type { DmrvJob, EvidencePackage } from "./types";

function snapshotId(job: DmrvJob): string | null {
  const value = job.result?.snapshot_id;
  return typeof value === "string" ? value : null;
}

export default function EvidencePackagePanel({
  projectId,
  canWrite,
  onChanged,
}: {
  projectId: string;
  canWrite: boolean;
  onChanged?: () => void;
}) {
  const t = useI18nStore((s) => s.t);
  const [jobs, setJobs] = useState<DmrvJob[]>([]);
  const [packages, setPackages] = useState<EvidencePackage[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState("");
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextJobs, nextPackages] = await Promise.all([
        listDmrvJobs(projectId),
        listEvidencePackages(projectId),
      ]);
      setJobs(nextJobs);
      setPackages(nextPackages);
      const firstSnapshotJob = nextJobs.find((job) => job.status === "succeeded" && snapshotId(job));
      const firstSnapshot = firstSnapshotJob ? snapshotId(firstSnapshotJob) ?? "" : "";
      setSelectedSnapshot((current) => current || firstSnapshot);
      setError("");
    } catch (cause) {
      setError(describeDmrvError(cause, t));
      setJobs([]);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    setJobs([]);
    setPackages([]);
    setSelectedSnapshot("");
    setVerified({});
    setError("");
    setNotice("");
    void refresh();
  }, [projectId, refresh]);

  async function createPackage() {
    if (!canWrite || !selectedSnapshot || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await createEvidencePackage(projectId, selectedSnapshot, newIdempotencyKey());
      await refresh();
      onChanged?.();
      setNotice(row.readiness === "ready" ? t("dmrv.evidence.createdReady") : t("dmrv.evidence.createdIncomplete"));
    } catch (cause) {
      setError(describeDmrvError(cause, t));
    } finally {
      setBusy(false);
    }
  }

  async function verify(packageId: string) {
    setVerifying(packageId);
    setError("");
    try {
      const result = await verifyEvidencePackage(projectId, packageId);
      setVerified((current) => ({ ...current, [packageId]: result.valid }));
      if (!result.valid) setError(t("dmrv.evidence.integrityFailed"));
    } catch (cause) {
      setError(describeDmrvError(cause, t));
    } finally {
      setVerifying("");
    }
  }

  const snapshots = [...new Set(jobs
    .filter((job) => job.status === "succeeded")
    .map(snapshotId)
    .filter((id): id is string => Boolean(id)))];

  return (
    <section className="card card-body" aria-labelledby="dmrv-evidence-heading">
      <h2 id="dmrv-evidence-heading" className="h5">{t("dmrv.evidence.heading")}</h2>
      <p className="text-muted small">{t("dmrv.evidence.caveat")}</p>
      {error ? <div role="alert" className="alert alert-danger">{error}</div> : null}
      {notice ? <div role="status" className="alert alert-info">{notice}</div> : null}
      {!canWrite ? <p className="text-muted small">{t("dmrv.evidence.readOnly")}</p> : null}

      {canWrite ? (
        <div className="row g-2 align-items-end mb-3">
          <div className="col-12 col-md-8">
            <label className="form-label" htmlFor="dmrv-evidence-snapshot">{t("dmrv.evidence.snapshot")}</label>
            <select
              id="dmrv-evidence-snapshot"
              className="form-select"
              value={selectedSnapshot}
              onChange={(event) => setSelectedSnapshot(event.target.value)}
              disabled={snapshots.length === 0}
            >
              <option value="">{t("dmrv.evidence.chooseSnapshot")}</option>
              {snapshots.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-primary" disabled={busy || !selectedSnapshot} onClick={() => void createPackage()}>
              {busy ? t("dmrv.evidence.creating") : t("dmrv.evidence.create")}
            </button>
          </div>
          {snapshots.length === 0 ? <p className="small text-muted mb-0">{t("dmrv.evidence.snapshotRequired")}</p> : null}
        </div>
      ) : null}

      {loading ? <p role="status">{t("dmrv.loading")}</p> : null}
      {!loading && packages.length === 0 && !error ? <p className="text-muted">{t("dmrv.evidence.empty")}</p> : null}
      {packages.map((item) => (
        <article className="border rounded p-3 mb-3" key={item.id} aria-label={`${t("dmrv.evidence.package")} ${item.id}`}>
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <div>
              <h3 className="h6 mb-1">{t("dmrv.evidence.package")} <code>{item.id.slice(0, 8)}</code></h3>
              <p className="small mb-1">{t("dmrv.evidence.status")}: {t(`dmrv.evidence.readiness.${item.readiness}`)}</p>
              <p className="small mb-1">{t("dmrv.evidence.snapshotHash")}: <code>{item.manifest.snapshot.sha256}</code></p>
              <p className="small mb-1">{t("dmrv.evidence.packageHash")}: <code>{item.package_sha256}</code></p>
              {item.manifest.carbon_mrv_status ? (
                <p className="small mb-1">
                  Carbon dMRV: estimate {item.manifest.carbon_mrv_status.estimate || "-"} ·
                  calibration {item.manifest.carbon_mrv_status.calibration || "-"} ·
                  validation {item.manifest.carbon_mrv_status.validation || "not_validated"} ({item.manifest.carbon_mrv_status.validation_type || "none"}) ·
                  segmentation {item.manifest.carbon_mrv_status.segmentation || "not_linked"} ·
                  review {item.manifest.carbon_mrv_status.review || "not_reviewed"} ·
                  accounting {item.manifest.carbon_mrv_status.accounting || "not_calculated"} ·
                  registry {item.manifest.carbon_mrv_status.registry || "not_connected"}
                </p>
              ) : null}
              {verified[item.id] === true ? <p className="small text-success mb-0">{t("dmrv.evidence.integrityPassed")}</p> : null}
            </div>
            <div className="d-flex align-items-start gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={verifying === item.id} onClick={() => void verify(item.id)}>
                {verifying === item.id ? t("dmrv.evidence.verifying") : t("dmrv.evidence.verify")}
              </button>
              <a
                className="btn btn-outline-primary btn-sm"
                href={`${env.apiBaseUrl}${evidencePackageDownloadPath(projectId, item.id)}`}
                download
              >{t("dmrv.evidence.download")}</a>
            </div>
          </div>
          {item.missing_components.length > 0 ? (
            <div className="alert alert-warning mt-3 mb-0">
              <strong>{t("dmrv.evidence.missingHeading")}</strong>
              <ul className="mb-0 mt-2">
                {item.missing_components.map((component) => (
                  <li key={component}>{t(`dmrv.evidence.component.${component}`)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
