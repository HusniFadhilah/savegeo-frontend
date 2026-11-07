import { useCallback, useEffect, useState } from "react";
import { useI18nStore } from "@/hooks/useI18nStore";
import { describeDmrvError } from "./errors";
import {
  createDmrvFinding,
  createSubmissionDraft,
  decideDmrvSubmission,
  listDmrvFindings,
  listDmrvSubmissions,
  listEvidencePackages,
  newIdempotencyKey,
  resolveDmrvFinding,
  respondDmrvFinding,
  startDmrvReview,
  submitDmrvSubmission,
} from "./api";
import type { DmrvReviewFinding, DmrvSubmission, EvidencePackage } from "./types";

export default function SubmissionReviewPanel({
  projectId,
  canSubmit,
  canReview,
  refreshToken = 0,
}: {
  projectId: string;
  canSubmit: boolean;
  canReview: boolean;
  refreshToken?: number;
}) {
  const t = useI18nStore((s) => s.t);
  const [packages, setPackages] = useState<EvidencePackage[]>([]);
  const [submissions, setSubmissions] = useState<DmrvSubmission[]>([]);
  const [findings, setFindings] = useState<Record<string, DmrvReviewFinding[]>>({});
  const [selectedPackage, setSelectedPackage] = useState("");
  const [findingCode, setFindingCode] = useState("");
  const [findingMessage, setFindingMessage] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextPackages, nextSubmissions] = await Promise.all([
        listEvidencePackages(projectId),
        listDmrvSubmissions(projectId),
      ]);
      const nextFindings = await Promise.all(nextSubmissions.map(async (row) => [
        row.id,
        await listDmrvFindings(projectId, row.id),
      ] as const));
      setPackages(nextPackages);
      setSubmissions(nextSubmissions);
      setFindings(Object.fromEntries(nextFindings));
      setSelectedPackage((current) => current || nextPackages[0]?.id || "");
      setError("");
    } catch (cause) {
      setError(describeDmrvError(cause, t));
      setPackages([]);
      setSubmissions([]);
      setFindings({});
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    setPackages([]);
    setSubmissions([]);
    setFindings({});
    setSelectedPackage("");
    setError("");
    void refresh();
  }, [projectId, refresh, refreshToken]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(describeDmrvError(cause, t));
    } finally {
      setBusy(false);
    }
  }

  function createDraft(supersedesId?: string) {
    if (!selectedPackage || !canSubmit) return;
    void perform(() => createSubmissionDraft(projectId, selectedPackage, newIdempotencyKey(), supersedesId));
  }

  function decision(submissionId: string, value: "approved" | "changes_requested" | "rejected") {
    const reason = decisionReasons[submissionId]?.trim();
    if (!reason) {
      setError(t("dmrv.review.reasonRequired"));
      return;
    }
    void perform(() => decideDmrvSubmission(projectId, submissionId, value, reason));
  }

  return (
    <section className="card card-body mt-3" aria-labelledby="dmrv-submission-heading">
      <h2 id="dmrv-submission-heading" className="h5">{t("dmrv.review.heading")}</h2>
      <p className="text-muted small">{t("dmrv.review.caveat")}</p>
      {error ? <div role="alert" className="alert alert-danger">{error}</div> : null}
      {canSubmit ? (
        <div className="row g-2 align-items-end mb-3">
          <div className="col-12 col-md-8">
            <label htmlFor="dmrv-submission-package" className="form-label">{t("dmrv.review.evidencePackage")}</label>
            <select id="dmrv-submission-package" className="form-select" value={selectedPackage} onChange={(event) => setSelectedPackage(event.target.value)}>
              <option value="">{t("dmrv.review.choosePackage")}</option>
              {packages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id.slice(0, 8)} · {t(`dmrv.evidence.readiness.${item.readiness}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <button type="button" className="btn btn-outline-primary" disabled={busy || !selectedPackage} onClick={() => createDraft()}>
              {t("dmrv.review.createDraft")}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <p role="status">{t("dmrv.loading")}</p> : null}
      {!loading && submissions.length === 0 && !error ? <p className="text-muted">{t("dmrv.review.empty")}</p> : null}
      {submissions.map((submission) => {
        const packageRow = packages.find((item) => item.id === submission.evidence_package_id);
        const rowFindings = findings[submission.id] ?? [];
        const unresolved = rowFindings.some((finding) => finding.status !== "resolved");
        return (
          <article className="border rounded p-3 mb-3" key={submission.id} aria-label={`${t("dmrv.review.submission")} v${submission.version}`}>
            <div className="d-flex flex-wrap justify-content-between gap-2">
              <div>
                <h3 className="h6 mb-1">{t("dmrv.review.submission")} v{submission.version}</h3>
                <p className="small mb-1">{t("dmrv.review.status")}: {t(`dmrv.review.status.${submission.status}`)}</p>
                <p className="small mb-1">{t("dmrv.review.snapshotHash")}: <code>{submission.locked_snapshot_hash}</code></p>
                <p className="small mb-0">{t("dmrv.review.manifestHash")}: <code>{submission.locked_manifest_hash}</code></p>
              </div>
              <div className="d-flex flex-wrap align-items-start gap-2">
                {canSubmit && submission.status === "draft" ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy || packageRow?.readiness !== "ready"}
                    title={packageRow?.readiness !== "ready" ? t("dmrv.review.packageIncomplete") : undefined}
                    onClick={() => void perform(() => submitDmrvSubmission(projectId, submission.id))}
                  >{t("dmrv.review.submit")}</button>
                ) : null}
                {canReview && (submission.status === "submitted" || submission.status === "changes_requested") ? (
                  <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={() => void perform(() => startDmrvReview(projectId, submission.id))}>
                    {t("dmrv.review.start")}
                  </button>
                ) : null}
                {canSubmit && submission.status === "changes_requested" ? (
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy || !selectedPackage} onClick={() => createDraft(submission.id)}>
                    {t("dmrv.review.createRevision")}
                  </button>
                ) : null}
              </div>
            </div>
            {packageRow?.missing_components.length ? (
              <div className="alert alert-warning mt-3 mb-0 small">{t("dmrv.review.packageIncomplete")}</div>
            ) : null}
            {submission.decision_reason ? <p className="small mt-2 mb-0">{t("dmrv.review.decisionReason")}: {submission.decision_reason}</p> : null}

            {submission.status === "under_review" ? (
              <div className="mt-3 border-top pt-3">
                <h4 className="h6">{t("dmrv.review.findings")}</h4>
                {rowFindings.length === 0 ? <p className="small text-muted">{t("dmrv.review.noFindings")}</p> : null}
                {rowFindings.map((finding) => (
                  <div className="border rounded p-2 mb-2" key={finding.id}>
                    <strong>{finding.code}</strong> · {t(`dmrv.review.findingStatus.${finding.status}`)}
                    <p className="mb-1">{finding.message}</p>
                    {finding.response ? <p className="small mb-1">{t("dmrv.review.response")}: {finding.response}</p> : null}
                    {canSubmit && finding.status === "open" ? (
                      <form className="d-flex gap-2" onSubmit={(event) => {
                        event.preventDefault();
                        const response = responses[finding.id]?.trim();
                        if (response) void perform(() => respondDmrvFinding(projectId, submission.id, finding.id, response));
                      }}>
                        <label className="visually-hidden" htmlFor={`dmrv-response-${finding.id}`}>{t("dmrv.review.response")}</label>
                        <input id={`dmrv-response-${finding.id}`} className="form-control form-control-sm" value={responses[finding.id] ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [finding.id]: event.target.value }))} maxLength={4000} />
                        <button className="btn btn-outline-primary btn-sm" type="submit" disabled={busy || !responses[finding.id]?.trim()}>{t("dmrv.review.respond")}</button>
                      </form>
                    ) : null}
                    {canReview && finding.status === "responded" ? (
                      <button type="button" className="btn btn-outline-success btn-sm" disabled={busy} onClick={() => void perform(() => resolveDmrvFinding(projectId, submission.id, finding.id))}>
                        {t("dmrv.review.resolve")}
                      </button>
                    ) : null}
                  </div>
                ))}
                {canReview ? (
                  <form className="row g-2 mb-3" onSubmit={(event) => {
                    event.preventDefault();
                    if (!findingCode.trim() || !findingMessage.trim()) return;
                    void perform(() => createDmrvFinding(
                      projectId, submission.id, { code: findingCode.trim(), message: findingMessage.trim() }, newIdempotencyKey(),
                    ));
                    setFindingCode("");
                    setFindingMessage("");
                  }}>
                    <div className="col-12 col-md-3">
                      <label className="form-label" htmlFor={`dmrv-finding-code-${submission.id}`}>{t("dmrv.review.findingCode")}</label>
                      <input id={`dmrv-finding-code-${submission.id}`} className="form-control form-control-sm" value={findingCode} onChange={(event) => setFindingCode(event.target.value)} required maxLength={64} />
                    </div>
                    <div className="col-12 col-md-7">
                      <label className="form-label" htmlFor={`dmrv-finding-message-${submission.id}`}>{t("dmrv.review.findingMessage")}</label>
                      <input id={`dmrv-finding-message-${submission.id}`} className="form-control form-control-sm" value={findingMessage} onChange={(event) => setFindingMessage(event.target.value)} required maxLength={4000} />
                    </div>
                    <div className="col-auto align-self-end">
                      <button type="submit" className="btn btn-outline-primary btn-sm" disabled={busy || !findingCode.trim() || !findingMessage.trim()}>{t("dmrv.review.addFinding")}</button>
                    </div>
                  </form>
                ) : null}
                {canReview ? (
                  <div className="row g-2 align-items-end">
                    <div className="col-12 col-md-8">
                      <label className="form-label" htmlFor={`dmrv-decision-reason-${submission.id}`}>{t("dmrv.review.decisionReason")}</label>
                      <input id={`dmrv-decision-reason-${submission.id}`} className="form-control form-control-sm" value={decisionReasons[submission.id] ?? ""} onChange={(event) => setDecisionReasons((current) => ({ ...current, [submission.id]: event.target.value }))} maxLength={4000} />
                    </div>
                    <div className="col-auto d-flex gap-2">
                      <button type="button" className="btn btn-success btn-sm" disabled={busy || unresolved} onClick={() => decision(submission.id, "approved")}>{t("dmrv.review.approve")}</button>
                      <button type="button" className="btn btn-outline-warning btn-sm" disabled={busy || !unresolved} onClick={() => decision(submission.id, "changes_requested")}>{t("dmrv.review.requestChanges")}</button>
                      <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => decision(submission.id, "rejected")}>{t("dmrv.review.reject")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
