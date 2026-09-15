import { fmtNum, styleFor, WATER_STRESS_STYLE } from "../utils";
import type { WaterMoistureResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  waterMoisture: WaterMoistureResult;
}

/** Sub-analysis E: NDMI water/moisture stress. */
export default function WaterMoisturePanel({ waterMoisture }: Props) {
  const t = useI18nStore((state) => state.t);
  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-droplet-fill me-1" /> {t("crop.card.moistureTitle")}
      </div>
      <div className="card-body">
        {!waterMoisture.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">
            {t("crop.unavailable")}{waterMoisture.reason ? `: ${waterMoisture.reason}` : "."}
          </div>
        ) : (
          <>
            <div className="row g-2 mb-2">
              <div className="col-6 col-md-4">
                <div className="text-muted small">{t("crop.ndmiMean")}</div>
                <div className="fw-bold">{fmtNum(waterMoisture.ndmi_mean, 4)}</div>
              </div>
              <div className="col-6 col-md-4">
                <div className="text-muted small">{t("crop.moistureStressArea")}</div>
                <div className="fw-bold">{fmtNum(waterMoisture.moisture_stress_area_ha, 2)} ha</div>
              </div>
              <div className="col-6 col-md-4">
                <div className="text-muted small">{t("crop.waterStressStatus")}</div>
                <span className={`fw-bold ${styleFor(WATER_STRESS_STYLE, waterMoisture.water_stress_label).className}`}>
                  {styleFor(WATER_STRESS_STYLE, waterMoisture.water_stress_label).emoji}{" "}
                  {styleFor(WATER_STRESS_STYLE, waterMoisture.water_stress_label).label}
                </span>
              </div>
            </div>
            <hr className="my-2" />
            <div className="small text-muted mb-1">{t("crop.rainfallPeriod")}</div>
            <div className="row g-2 text-center">
              <div className="col-4">
                <div className="fw-bold">{fmtNum(waterMoisture.rainfall.rainfall_mm_period, 1)} mm</div>
                <div className="small text-muted">{t("crop.period.label")}</div>
              </div>
              <div className="col-4">
                <div className="fw-bold">{fmtNum(waterMoisture.rainfall.rainfall_mm_historical_normal, 1)} mm</div>
                <div className="small text-muted">{t("crop.historicalNormal")}</div>
              </div>
              <div className="col-4">
                <div className="fw-bold">
                  {waterMoisture.rainfall.rainfall_deficit_pct != null ? `${fmtNum(waterMoisture.rainfall.rainfall_deficit_pct, 1)}%` : "-"}
                </div>
                <div className="small text-muted">{t("crop.deficit")}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
