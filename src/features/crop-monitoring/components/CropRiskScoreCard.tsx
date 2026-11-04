import CropPanelAccordion from "./CropPanelAccordion";
import { fmtNum, fmtPct, styleFor, RISK_LEVEL_STYLE } from "../utils";
import type { RiskScoreResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  riskScore: RiskScoreResult;
}

const FACTOR_LABEL: Record<string, string> = {
  vegetation: "crop.factor.vegetation",
  moisture: "crop.factor.moisture",
  weather: "crop.factor.weather",
  flood: "crop.factor.flood",
  growth_anomaly: "crop.factor.growthAnomaly",
};

/** Sub-analysis J: composite risk score. Emoji-per-severity breakdown list. */
export default function CropRiskScoreCard({ riskScore }: Props) {
  const t = useI18nStore((state) => state.t);
  return (
    <CropPanelAccordion title={t("crop.card.riskTitle")} icon="bi-shield-exclamation">
      {!riskScore.available ? (
        <div className="alert alert-secondary py-2 mb-0 small">{t("crop.unavailable")}.</div>
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
                <strong>{FACTOR_LABEL[item.factor] ? t(FACTOR_LABEL[item.factor]) : item.factor}</strong> {fmtNum(item.score, 1)}%{" "}
                <span className="text-muted">({t("crop.weight")} {fmtPct(item.weight * 100, 0)})</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </CropPanelAccordion>
  );
}
