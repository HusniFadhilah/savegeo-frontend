import { CONFIDENCE_LABEL, GROWTH_STAGE_LABEL } from "../utils";
import type { Commodity, GrowthStageResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  growthStage: GrowthStageResult;
  commodity: Commodity | undefined;
}

/** Sub-analysis D: growth stage. Simple filled progress bar of
 * days-elapsed/estimated_duration (no per-commodity stage table endpoint
 * exists, so this stays a single current-stage summary, not a full timeline). */
export default function GrowthStagePanel({ growthStage, commodity }: Props) {
  const t = useI18nStore((state) => state.t);
  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-flower2 me-1" /> {t("crop.card.growthTitle")}
      </div>
      <div className="card-body">
        {!growthStage.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">
            {t("crop.unavailable")}{growthStage.reason ? `: ${growthStage.reason}` : "."}
          </div>
        ) : (
          <>
            <div className="row g-2 mb-3">
              <div className="col-6 col-md-3">
                <div className="text-muted small">{t("crop.currentStage")}</div>
                <div className="fw-bold">{GROWTH_STAGE_LABEL[growthStage.stage_key] ?? growthStage.stage}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">{t("crop.cropAge")}</div>
                <div className="fw-bold">{growthStage.crop_age_days} hari</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">{t("crop.confidence")}</div>
                <div className="fw-bold">{CONFIDENCE_LABEL[growthStage.confidence] ?? growthStage.confidence}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted small">{t("crop.estimatedHarvest")}</div>
                <div className="fw-bold">{growthStage.estimated_harvest_date ?? "-"}</div>
              </div>
            </div>
            {commodity && (
              <>
                <div className="progress" style={{ height: 14 }}>
                  <div
                    className="progress-bar bg-success"
                    style={{
                      width: `${Math.min(100, (growthStage.crop_age_days / commodity.estimated_duration_days) * 100)}%`,
                    }}
                  >
                    {Math.min(100, Math.round((growthStage.crop_age_days / commodity.estimated_duration_days) * 100))}%
                  </div>
                </div>
                <small className="text-muted d-block mt-1">
                  {growthStage.crop_age_days} / {commodity.estimated_duration_days} hari siklus {commodity.label}
                </small>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
