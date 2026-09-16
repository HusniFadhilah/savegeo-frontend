import { useCallback, useEffect, useState } from "react";
import { getDisasterEvent } from "../../api";
import type { DisasterEvent, DisasterEventDetail } from "../../types";
import DisasterEventList from "./DisasterEventList";
import DisasterEventForm from "./DisasterEventForm";
import AoiManager from "./AoiManager";
import ImageryManager from "./ImageryManager";
import AnalysisManager from "./AnalysisManager";
import AnalysisReview from "./AnalysisReview";
import DisasterAuditTrail from "./DisasterAuditTrail";
import { useI18nStore } from "@/hooks/useI18nStore";

type Mode = "list" | "create" | "detail";
type DetailTab = "info" | "aoi" | "imagery" | "analysis" | "review" | "audit";

const DETAIL_TABS: { id: DetailTab; icon: string; labelKey: string }[] = [
  { id: "info", icon: "bi-info-circle", labelKey: "admin.disaster.info" },
  { id: "aoi", icon: "bi-vector-pen", labelKey: "admin.disaster.aoi" },
  { id: "imagery", icon: "bi-image", labelKey: "admin.disaster.imagery" },
  { id: "analysis", icon: "bi-cpu", labelKey: "admin.disaster.analysis" },
  { id: "review", icon: "bi-clipboard-check", labelKey: "admin.disaster.review" },
  { id: "audit", icon: "bi-clock-history", labelKey: "admin.disaster.audit" },
];

/**
 * Entry point registered as AdminDashboard's "Disaster Management" tab.
 * List <-> detail-workspace container - the detail workspace is a sub-tab
 * bar (Info/AOI/Imagery/Analysis/Review/Audit) over one `DisasterEventDetail`
 * fetched from `GET /admin/disasters/{id}` and re-fetched after every
 * mutation any sub-tab makes.
 */
export default function DisasterManagement() {
  const t = useI18nStore((state) => state.t);
  const [mode, setMode] = useState<Mode>("list");
  const [listReloadKey, setListReloadKey] = useState(0);

  const [detailEventId, setDetailEventId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");
  const [detail, setDetail] = useState<DisasterEventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDetail = useCallback((id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    getDisasterEvent(id)
      .then(setDetail)
      .catch((err) => setDetailError(err instanceof Error ? err.message : t("admin.disaster.loadFailed")))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    if (mode === "detail" && detailEventId != null) {
      loadDetail(detailEventId);
    }
  }, [mode, detailEventId, loadDetail]);

  const openDetail = (event: DisasterEvent, tab: DetailTab = "info") => {
    setDetailEventId(event.id);
    setDetailTab(tab);
    setMode("detail");
  };

  const backToList = () => {
    setMode("list");
    setDetail(null);
    setDetailEventId(null);
    setListReloadKey((k) => k + 1);
  };

  if (mode === "create") {
    return (
      <DisasterEventForm
        onSaved={(ev) => openDetail(ev, "aoi")}
        onCancel={() => setMode("list")}
      />
    );
  }

  if (mode === "detail" && detailEventId != null) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <button type="button" className="btn-sm" onClick={backToList}>
            <i className="bi bi-arrow-left" /> {t("admin.disaster.backToList")}
          </button>
          {detail && (
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {detail.event.name}
            </div>
          )}
          <span />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: "0.75rem", flexWrap: "wrap" }}>
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn-sm ${detailTab === tab.id ? "primary" : ""}`}
              onClick={() => setDetailTab(tab.id)}
            >
              <i className={`bi ${tab.icon}`} /> {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {detailLoading && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{t("admin.loading")}</div>}
        {detailError && <div className="alert alert-danger py-1 px-2 small">{detailError}</div>}

        {detail && !detailLoading && (
          <>
            {detailTab === "info" && (
              <DisasterEventForm
                event={detail.event}
                onSaved={(ev) => setDetail((d) => (d ? { ...d, event: ev } : d))}
              />
            )}
            {detailTab === "aoi" && (
              <AoiManager
                eventId={detail.event.id}
                aoi={detail.aoi}
                onSaved={(aoi) => setDetail((d) => (d ? { ...d, aoi } : d))}
              />
            )}
            {detailTab === "imagery" && (
              <ImageryManager
                eventId={detail.event.id}
                imagery={detail.imagery}
                onChanged={() => loadDetail(detail.event.id)}
              />
            )}
            {detailTab === "analysis" && (
              <AnalysisManager
                eventId={detail.event.id}
                aoi={detail.aoi}
                imagery={detail.imagery}
                runs={detail.runs}
                onChanged={() => loadDetail(detail.event.id)}
              />
            )}
            {detailTab === "review" && (
              <AnalysisReview
                eventId={detail.event.id}
                runs={detail.runs}
                onChanged={() => loadDetail(detail.event.id)}
              />
            )}
            {detailTab === "audit" && <DisasterAuditTrail eventId={detail.event.id} />}
          </>
        )}
      </div>
    );
  }

  return (
    <DisasterEventList
      reloadKey={listReloadKey}
      onCreateNew={() => setMode("create")}
      onEdit={(ev) => openDetail(ev, "info")}
      onOpen={(ev) => openDetail(ev, "analysis")}
    />
  );
}
