import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { useI18nStore } from "@/hooks/useI18nStore";
import { getArrIllustrativeExample } from "./api";
import { describeDmrvError } from "./errors";
import type { ArrIllustrativePreview } from "./types";

export default function ArrIllustrativeAccountingPage() {
  const t = useI18nStore((s) => s.t);
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
      <section className="mx-auto px-3 pt-3" style={{ maxWidth: 960 }}>
        <p><Link to="/dmrv/projects">{t("dmrv.example.back")}</Link></p>
        <h1 className="h4 mb-3">{t("dmrv.example.heading")}</h1>
        <div className="alert alert-warning" role="note">{t("dmrv.example.caveat")}</div>
        {error !== null ? <div role="alert" className="alert alert-danger">{describeDmrvError(error, t)}</div> : null}
        {!preview && error === null ? <p role="status">{t("dmrv.loading")}</p> : null}
        {preview ? (
          <>
            <div className="card card-body mb-3">
              <h2 className="h6">{t("dmrv.example.resultStatus")}</h2>
              <dl className="row mb-0">
                <dt className="col-sm-4">{t("dmrv.example.qualification")}</dt>
                <dd className="col-sm-8">{t("dmrv.example.illustrativeOnly")}</dd>
                <dt className="col-sm-4">{t("dmrv.example.verification")}</dt>
                <dd className="col-sm-8">{t("dmrv.example.notVerified")}</dd>
                <dt className="col-sm-4">{t("dmrv.example.issuance")}</dt>
                <dd className="col-sm-8">{t("dmrv.example.notIssued")}</dd>
              </dl>
            </div>

            <div className="card card-body mb-3">
              <h2 className="h6">{t("dmrv.example.inputsHeading")}</h2>
              <dl className="row mb-0">
                {preview.normalized_inputs.map((input) => (
                  <div className="row" key={input.key}>
                    <dt className="col-sm-7">{t(`dmrv.example.input.${input.key}`)}</dt>
                    <dd className="col-sm-5">{showValue(input.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="card card-body">
              <h2 className="h6">{t("dmrv.example.ledgerHeading")}</h2>
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
      </section>
    </DashboardShell>
  );
}
