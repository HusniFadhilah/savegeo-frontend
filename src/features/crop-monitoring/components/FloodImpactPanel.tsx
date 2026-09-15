import { useState } from "react";
import { ApiError } from "@/services/apiClient";
import { runCropMonitoring } from "../api";
import { fmtNum, fmtPct, styleFor, FLOOD_SEVERITY_STYLE } from "../utils";
import type { FloodResult } from "../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  fieldId: number;
  flood: FloodResult | undefined;
  onResult: (flood: FloodResult) => void;
}

/**
 * Sub-analysis G: flood impact. Never auto-included server-side (needs
 * pre_date/post_date), so this panel owns its own inline date inputs and a
 * scoped run (sub_analyses: ["flood"]) independent of the main "Run" button.
 * Only rendered by the parent module when the user has explicitly checked
 * "flood" in the sub-analyses list.
 */
export default function FloodImpactPanel({ fieldId, flood, onResult }: Props) {
  const t = useI18nStore((state) => state.t);
  const [preDate, setPreDate] = useState("");
  const [postDate, setPostDate] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    if (!preDate || !postDate) {
      setError(t("crop.flood.datesRequired"));
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await runCropMonitoring({
        field_id: fieldId,
        sub_analyses: ["flood"],
        flood: { pre_date: preDate, post_date: postDate },
      });
      onResult(res.sub_analyses.flood ?? { available: false, reason: t("crop.noResult") });
    } catch (err) {
      setError(err instanceof ApiError ? (err.payload as { detail?: string })?.detail ?? err.message : t("crop.flood.runFailed"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card mb-3">
      <div className="card-header">
        <i className="bi bi-water me-1" /> {t("crop.card.floodTitle")}
      </div>
      <div className="card-body">
        <div className="d-flex gap-2 align-items-end flex-wrap mb-2">
          <div>
            <label className="form-label small mb-1">{t("crop.flood.beforeDate")}</label>
            <input type="date" className="form-control form-control-sm" value={preDate} onChange={(e) => setPreDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label small mb-1">{t("crop.flood.afterDate")}</label>
            <input type="date" className="form-control form-control-sm" value={postDate} onChange={(e) => setPostDate(e.target.value)} />
          </div>
          <button type="button" className="btn btn-sm btn-primary" onClick={handleRun} disabled={running}>
            {running ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" /> {t("admin.processing")}
              </>
            ) : (
              <>
                <i className="bi bi-play-fill me-1" /> {t("crop.runShort")}
              </>
            )}
          </button>
        </div>
        {error && <div className="alert alert-danger py-2 small mb-2">{error}</div>}

        {!flood ? (
          <div className="alert alert-secondary py-2 mb-0 small">{t("crop.notRun")}</div>
        ) : !flood.available ? (
          <div className="alert alert-secondary py-2 mb-0 small">
            {t("crop.unavailable")}{flood.reason ? `: ${flood.reason}` : "."}
          </div>
        ) : (
          <div className="row g-2 text-center">
            <div className="col-6 col-md-3">
              <div className="fw-bold">{fmtNum(flood.statistics.flooded_area_ha, 2)} ha</div>
              <div className="small text-muted">{t("crop.flood.totalFlooded")}</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="fw-bold">{fmtNum(flood.statistics.new_inundation_ha, 2)} ha</div>
              <div className="small text-muted">{t("crop.flood.newFlooded")}</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="fw-bold">{flood.flooded_pct_of_field != null ? fmtPct(flood.flooded_pct_of_field) : "-"}</div>
              <div className="small text-muted">{t("crop.flood.fieldPercent")}</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="text-muted small">{t("crop.severity")}</div>
              <span className={`fw-bold ${styleFor(FLOOD_SEVERITY_STYLE, flood.severity).className}`}>
                {styleFor(FLOOD_SEVERITY_STYLE, flood.severity).emoji} {styleFor(FLOOD_SEVERITY_STYLE, flood.severity).label}
              </span>
            </div>
            {flood.tile_url && (
              <div className="col-12">
                <small className="text-muted">Lihat layer peta "Banjir" di panel Peta Hasil di bawah.</small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
