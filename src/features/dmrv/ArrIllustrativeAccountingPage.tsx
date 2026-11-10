import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { useI18nStore } from "@/hooks/useI18nStore";
import { getArrIllustrativeExample } from "./api";
import DmrvPageHeader from "./DmrvPageHeader";
import { describeDmrvError } from "./errors";
import type { ArrIllustrativePreview } from "./types";

export default function ArrIllustrativeAccountingPage() {
  const t = useI18nStore((state) => state.t);
  const [preview, setPreview] = useState<ArrIllustrativePreview | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    getArrIllustrativeExample()
      .then((result) => { if (active) setPreview(result); })
      .catch((cause: unknown) => { if (active) setError(cause); });
    return () => { active = false; };
  }, []);

  const showValue = (value: string | null) =>
    value === null ? t("dmrv.example.missing") : value;

  return (
    <DashboardShell>
      <main className="analysis-page dmrv-page">
        <DmrvPageHeader
          breadcrumbs={[
            { label: t("dmrv.breadcrumb.home"), to: "/" },
            { label: t("dmrv.breadcrumb.projects"), to: "/dmrv/projects" },
            { label: t("dmrv.breadcrumb.example") },
          ]}
          eyebrow={t("dmrv.example.real.kicker")}
          title={t("dmrv.example.heading")}
          description={t("dmrv.example.pageDescription")}
          metrics={[
            { icon: "bi-flask", label: t("dmrv.example.qualification"), value: t("dmrv.example.illustrativeOnly") },
            { icon: "bi-shield-x", label: t("dmrv.example.verification"), value: t("dmrv.example.notVerified") },
            { icon: "bi-award", label: t("dmrv.example.issuance"), value: t("dmrv.example.notIssued") },
          ]}
        />

        <div className="alert alert-warning" role="note">{t("dmrv.example.caveat")}</div>
        {error !== null ? <div role="alert" className="alert alert-danger">{describeDmrvError(error, t)}</div> : null}
        {!preview && error === null ? <p role="status">{t("dmrv.loading")}</p> : null}

        {preview ? (
          <>
            <div className="dmrv-panel mb-3">
              <h2 className="dmrv-panel-title">{t("dmrv.example.resultStatus")}</h2>
              <dl className="row mb-0">
                <dt className="col-sm-4">{t("dmrv.example.qualification")}</dt>
                <dd className="col-sm-8">{t("dmrv.example.illustrativeOnly")}</dd>
                <dt className="col-sm-4">{t("dmrv.example.verification")}</dt>
                <dd className="col-sm-8">{t("dmrv.example.notVerified")}</dd>
                <dt className="col-sm-4">{t("dmrv.example.issuance")}</dt>
                <dd className="col-sm-8">{t("dmrv.example.notIssued")}</dd>
              </dl>
            </div>

            <div className="dmrv-panel mb-3">
              <h2 className="dmrv-panel-title">{t("dmrv.example.inputsHeading")}</h2>
              <dl className="row mb-0">
                {preview.normalized_inputs.map((input) => (
                  <div className="row" key={input.key}>
                    <dt className="col-sm-7">{t(`dmrv.example.input.${input.key}`)}</dt>
                    <dd className="col-sm-5">{showValue(input.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="dmrv-panel">
              <h2 className="dmrv-panel-title">{t("dmrv.example.ledgerHeading")}</h2>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">{t("dmrv.example.lineHeading")}</th>
                      <th scope="col">{t("dmrv.example.valueHeading")}</th>
                      <th scope="col">{t("dmrv.example.unitHeading")}</th>
                      <th scope="col">{t("dmrv.example.equationHeading")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((line) => (
                      <tr key={line.key}>
                        <th scope="row">{t(`dmrv.example.line.${line.key}`)}</th>
                        <td>{showValue(line.value)}</td>
                        <td>{line.unit}</td>
                        <td><code>{line.equation}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.blockers.length > 0 ? (
                <div className="alert alert-info mt-3 mb-0" role="status">
                  <strong>{t("dmrv.example.netBlocked")}</strong>
                  <ul className="mb-0 mt-2">
                    {preview.blockers.map((blocker) => <li key={blocker}>{t(`dmrv.example.blocker.${blocker}`)}</li>)}
                  </ul>
                </div>
              ) : null}
              <p className="text-muted small mt-3 mb-0">
                {t("dmrv.example.roundingPolicy")}: {preview.rounding_policy} · {t("dmrv.example.formulaId")}: {preview.formula_id}
              </p>
            </div>
          </>
        ) : null}
      </main>
    </DashboardShell>
  );
}
