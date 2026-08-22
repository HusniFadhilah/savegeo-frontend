import { fmtNum, fmtPct, styleFor, RISK_LEVEL_STYLE } from "../utils";
import type { RiskScoreResult } from "../types";

interface Props {
  riskScore: RiskScoreResult;
}

const FACTOR_LABEL: Record<string, string> = {
  vegetation: "Vegetasi",
  moisture: "Kelembaban",
  weather: "Cuaca",
  flood: "Banjir",
  growth_anomaly: "Anomali Pertumbuhan",
};

/** Sub-analysis J: composite risk score. Emoji-per-severity breakdown list. */
export default function CropRiskScoreCard({ riskScore }: Props) {
  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-shield-exclamation me-1" /> J. Skor Risiko
      </div>
      <div className="card-body">
        {!riskScore.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">Tidak tersedia.</div>
        ) : (
          <>
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="display-5 fw-bold">{riskScore.score}/100</div>
              <span className={`fs-5 fw-bold ${styleFor(RISK_LEVEL_STYLE, riskScore.level).className}`}>
                {styleFor(RISK_LEVEL_STYLE, riskScore.level).emoji} {styleFor(RISK_LEVEL_STYLE, riskScore.level).label}
              </span>
            </div>
            <ul className="list-unstyled mb-0">
              {riskScore.breakdown.map((item) => (
                <li key={item.factor} className="mb-1">
                  {styleFor(RISK_LEVEL_STYLE, item.level).emoji}{" "}
                  <strong>{FACTOR_LABEL[item.factor] ?? item.factor}</strong> {fmtNum(item.score, 1)}%{" "}
                  <span className="text-muted">(bobot {fmtPct(item.weight * 100, 0)})</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
