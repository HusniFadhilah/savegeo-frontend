import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
import {
  ADMIN_DISASTER_NEW_PATH,
  ADMIN_SECTION_PATHS,
  getAdminDisasterEventPath,
  type AdminDisasterTab,
} from "@/routes/adminSectionRoutes";

const DETAIL_TABS: { id: AdminDisasterTab; icon: string; labelKey: string }[] = [
  { id: "info", icon: "bi-info-circle", labelKey: "admin.disaster.info" },
  { id: "aoi", icon: "bi-vector-pen", labelKey: "admin.disaster.aoi" },
  { id: "imagery", icon: "bi-image", labelKey: "admin.disaster.imagery" },
  { id: "analysis", icon: "bi-cpu", labelKey: "admin.disaster.analysis" },
  { id: "review", icon: "bi-clipboard-check", labelKey: "admin.disaster.review" },
  { id: "audit", icon: "bi-clock-history", labelKey: "admin.disaster.audit" },
];

function isDetailTab(value: string | undefined): value is AdminDisasterTab {
  return DETAIL_TABS.some((tab) => tab.id === value);
}

/**
 * Disaster admin pages are addressable routes:
 * /admin/disasters                         event list
 * /admin/disasters/new                     create an event
 * /admin/disasters/:eventId/:tab           event detail and active tab
 */
export default function DisasterManagement() {
  const t = useI18nStore((state) => state.t);
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId: eventIdParam, tab: tabParam } = useParams<{ eventId: string; tab: string }>();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const isCreatePage = normalizedPath === ADMIN_DISASTER_NEW_PATH;
  const eventId = eventIdParam && /^[1-9]\d*$/.test(eventIdParam) ? Number(eventIdParam) : null;
  const mode = isCreatePage ? "create" : eventId ? "detail" : "list";
  const detailTab: AdminDisasterTab = isDetailTab(tabParam) ? tabParam : "info";

  const [detail, setDetail] = useState<DisasterEventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDetail = useCallback((id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    getDisasterEvent(id)
      .then(setDetail)
      .catch((error) => setDetailError(error instanceof Error ? error.message : t("admin.disaster.loadFailed")))
      .finally(() => setDetailLoading(false));
  }, [t]);

  useEffect(() => {
    if (isCreatePage) return;

    if (eventIdParam && eventId === null) {
      navigate(ADMIN_SECTION_PATHS.ds, { replace: true });
      return;
    }

    if (eventId !== null) {
      const canonicalPath = getAdminDisasterEventPath(eventId, detailTab);
      if (location.pathname !== canonicalPath) {
        navigate(canonicalPath, { replace: true });
      }
      return;
    }

    if (normalizedPath !== ADMIN_SECTION_PATHS.ds) {
      navigate(ADMIN_SECTION_PATHS.ds, { replace: true });
    }
  }, [detailTab, eventId, eventIdParam, isCreatePage, location.pathname, navigate, normalizedPath]);

  useEffect(() => {
    if (mode === "detail" && eventId !== null) {
      loadDetail(eventId);
    } else {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
    }
  }, [eventId, loadDetail, mode]);

  const openDetail = (event: DisasterEvent, tab: AdminDisasterTab = "info") => {
    navigate(getAdminDisasterEventPath(event.id, tab));
  };

  const backToList = () => navigate(ADMIN_SECTION_PATHS.ds);

  if (mode === "create") {
    return (
      <DisasterEventForm
        onSaved={(event) => openDetail(event, "aoi")}
        onCancel={backToList}
      />
    );
  }

  if (mode === "detail" && eventId !== null) {
    return (
      <div>
        <div className="disaster-admin-detail-heading">
          <button type="button" className="btn-sm" onClick={backToList}>
            <i className="bi bi-arrow-left" /> {t("admin.disaster.backToList")}
          </button>
          {detail && <div className="disaster-admin-detail-name">{detail.event.name}</div>}
        </div>

        <nav className="disaster-admin-detail-tabs" aria-label="Tab kejadian bencana">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`btn-sm ${detailTab === tab.id ? "primary" : ""}`}
              aria-current={detailTab === tab.id ? "page" : undefined}
              onClick={() => navigate(getAdminDisasterEventPath(eventId, tab.id))}
            >
              <i className={`bi ${tab.icon}`} /> {t(tab.labelKey)}
            </button>
          ))}
        </nav>

        {detailLoading && <div style={{ color: "var(--text-muted)", fontSize: 12 }} role="status">{t("admin.loading")}</div>}
        {detailError && <div className="alert alert-danger py-1 px-2 small" role="alert">{detailError}</div>}

        {detail && !detailLoading && (
          <>
            {detailTab === "info" && (
              <DisasterEventForm
                event={detail.event}
                onSaved={(event) => setDetail((current) => (current ? { ...current, event } : current))}
              />
            )}
            {detailTab === "aoi" && (
              <AoiManager
                eventId={detail.event.id}
                aoi={detail.aoi}
                onSaved={(aoi) => setDetail((current) => (current ? { ...current, aoi } : current))}
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
      onCreateNew={() => navigate(ADMIN_DISASTER_NEW_PATH)}
      onEdit={(event) => openDetail(event, "info")}
      onOpen={(event) => openDetail(event, "analysis")}
    />
  );
}
