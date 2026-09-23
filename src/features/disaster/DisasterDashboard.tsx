import SegmentationComparison from "./components/SegmentationComparison";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { ApiError } from "@/services/apiClient";
import type { AoiFeature } from "@/types/map";
import {
  analyzeDemSlope,
  fetchBmkgAlerts,
  fetchDisasterEvent,
  fetchDisasterHotspots,
  fetchDisasterLayers,
  fetchDisasterSources,
  fetchDisasterStatistics,
} from "./api";
import {
  EVENT_DISASTER_TYPE_LABELS,
  SEVERITY_LABELS,
  type BmkgAlert,
  type DemSlopeResult,
  type DisasterEventDetailResponse,
  type DisasterLayersResponse,
  type DisasterSourcesMap,
  type DisasterStatisticsResponse,
  type EventDisasterType,
  type EventSeverity,
  type HotspotRecord,
  type FirmsLayerState,
  type FirmsHotspotFeature,
  isKarhutlaDisasterType,
} from "./types";
import SatelliteViewer from "./components/SatelliteViewer";
import LayerPanel from "./components/LayerPanel";
import KpiTiles from "./components/KpiTiles";
import StatisticsPanel from "./components/StatisticsPanel";
import HotspotPanel from "./components/HotspotPanel";
import SourceStatusPanel from "./components/SourceStatusPanel";
import BmkgAlerts from "./components/BmkgAlerts";
import DemSlopeControls from "./components/DemSlopeControls";
import FirmsHotspotPanel from "./components/FirmsHotspotPanel";
import { clearFirmsQuery } from "./lib/firmsQueryState";
import { useI18nStore } from "@/hooks/useI18nStore";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function severityBadgeClass(severity: string | null): string {
  switch (severity) {
    case "critical":
      return "bg-danger";
    case "high":
      return "bg-warning text-dark";
    case "medium":
      return "bg-info text-dark";
    default:
      return "bg-secondary";
  }
}

function typeIcon(type: string): string {
  switch (type) {
    case "flood":
      return "bi-water";
    case "earthquake":
      return "bi-activity";
    case "landslide":
      return "bi-triangle";
    case "wildfire":
      return "bi-fire";
    default:
      return "bi-exclamation-triangle";
  }
}

const EMPTY_FIRMS_LAYER: FirmsLayerState = {
  enabled: false,
  result: null,
  features: [],
  showLabels: false,
  cluster: true,
};

/**
 * Item D.14/D.48 of the redesign spec: single event view. Assembled from the
 * 4 independent `GET /disasters/{id}/*` calls the contract doc documents
 * (detail, layers [= satellite + analyses], statistics, hotspots) - each
 * loads/fails independently so one slow/broken section never blocks the
 * rest of the page, matching the pattern already used across this app's
 * other multi-section modules (carbon/lc-change).
 */
export default function DisasterDashboard() {
  const { t } = useI18nStore();
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useUserAuthStore();

  const [detail, setDetail] = useState<DisasterEventDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [layers, setLayers] = useState<DisasterLayersResponse | null>(null);
  const [layersLoading, setLayersLoading] = useState(true);
  const [layersError, setLayersError] = useState<string | null>(null);

  const [statistics, setStatistics] = useState<DisasterStatisticsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [hotspots, setHotspots] = useState<HotspotRecord[]>([]);
  const [hotspotsLoading, setHotspotsLoading] = useState(true);
  const [hotspotsError, setHotspotsError] = useState<string | null>(null);

  const [checkedAnalyses, setCheckedAnalyses] = useState<Set<string>>(new Set());
  const [showSatellite, setShowSatellite] = useState(false);
  const [showAoi, setShowAoi] = useState(true);
  const [showHotspots, setShowHotspots] = useState(true);
  const [highlightedHotspotId, setHighlightedHotspotId] = useState<number | null>(null);
  const [focusFeature, setFocusFeature] = useState<GeoJSON.Feature | GeoJSON.Geometry | GeoJSON.FeatureCollection | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [firmsLayer, setFirmsLayer] = useState<FirmsLayerState>(EMPTY_FIRMS_LAYER);

  const [additionalSourcesOpen, setAdditionalSourcesOpen] = useState(false);
  const [sources, setSources] = useState<DisasterSourcesMap | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<BmkgAlert[] | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [demResult, setDemResult] = useState<DemSlopeResult | null>(null);
  const [demLoading, setDemLoading] = useState(false);
  const [demError, setDemError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setFirmsLayer(EMPTY_FIRMS_LAYER);
    setDetailLoading(true);
    setDetailError(null);
    fetchDisasterEvent(eventId)
      .then((res) => {
        if (cancelled) return;
        setDetail(res);
        if (res.aoi?.geojson) {
          setFocusFeature(res.aoi.geojson);
          setFocusSignal((n) => n + 1);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(
          errorMessage(err, t("disaster.detail.loadFailed")),
        );
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // FIRMS is a wildfire-only layer. Reset local state and remove stale URL
  // controls when the selected event is a flood, earthquake, or another type.
  const isKarhutla = isKarhutlaDisasterType(detail?.event.disaster_type);
  useEffect(() => {
    if (!detail || isKarhutla) return;
    setFirmsLayer(EMPTY_FIRMS_LAYER);
    const next = clearFirmsQuery(searchParams);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [detail, isKarhutla, searchParams, setSearchParams]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLayersLoading(true);
    setLayersError(null);
    fetchDisasterLayers(eventId)
      .then((res) => {
        if (cancelled) return;
        setLayers(res);
        setCheckedAnalyses(new Set(res.analyses.filter((a) => a.available).map((a) => a.model_id)));
      })
      .catch((err) => {
        if (cancelled) return;
        setLayersError(errorMessage(err, t("disaster.detail.layersFailed")));
      })
      .finally(() => {
        if (!cancelled) setLayersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setStatsLoading(true);
    setStatsError(null);
    fetchDisasterStatistics(eventId)
      .then((res) => {
        if (!cancelled) setStatistics(res);
      })
      .catch((err) => {
        if (!cancelled)
          setStatsError(errorMessage(err, t("disaster.detail.statsFailed")));
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setHotspotsLoading(true);
    setHotspotsError(null);
    fetchDisasterHotspots(eventId)
      .then((res) => {
        if (!cancelled) setHotspots(res.hotspots ?? []);
      })
      .catch((err) => {
        if (!cancelled)
          setHotspotsError(errorMessage(err, t("disaster.detail.hotspotsFailed")));
      })
      .finally(() => {
        if (!cancelled) setHotspotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const toggleAnalysis = (modelId: string) => {
    setCheckedAnalyses((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const handleHotspotZoom = (hotspot: HotspotRecord) => {
    setShowHotspots(true);
    setHighlightedHotspotId(hotspot.id);
    setFocusFeature(hotspot.geojson);
    setFocusSignal((n) => n + 1);
  };

  const handleHotspotHighlight = (hotspotId: number) => {
    setHighlightedHotspotId((prev) => (prev === hotspotId ? null : hotspotId));
  };

  const handleFirmsZoom = (features: FirmsHotspotFeature[]) => {
    if (!features.length) return;
    setFocusFeature({ type: "FeatureCollection", features });
    setFocusSignal((n) => n + 1);
  };

  async function handleLoadSources() {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      setSources(await fetchDisasterSources());
    } catch (err) {
      setSourcesError(errorMessage(err, t("disaster.detail.sourcesFailed")));
    } finally {
      setSourcesLoading(false);
    }
  }

  async function handleLoadBmkg() {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const res = await fetchBmkgAlerts(20);
      setAlerts(res.alerts ?? []);
    } catch (err) {
      setAlertsError(errorMessage(err, t("disaster.detail.bmkgFailed")));
    } finally {
      setAlertsLoading(false);
    }
  }

  async function handleLoadDem() {
    if (!detail?.aoi?.geojson) {
      setDemError(t("disaster.detail.noAoi"));
      return;
    }
    setDemLoading(true);
    setDemError(null);
    try {
      const res = await analyzeDemSlope({
        aoi: { geojson: detail.aoi.geojson as AoiFeature },
        scale: 90,
      });
      setDemResult(res);
    } catch (err) {
      setDemError(errorMessage(err, t("disaster.detail.demFailed")));
    } finally {
      setDemLoading(false);
    }
  }

  if (detailLoading) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-info py-2">
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          />
          {t("disaster.detail.loading")}
        </div>
      </div>
    );
  }

  if (detailError || !detail) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger py-2">
          {detailError || t("disaster.detail.notFound")}
        </div>
        <Link to="/pemetaan-bencana" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left" /> {t("disaster.detail.backToList")}
        </Link>
      </div>
    );
  }

  const { event, aoi, imagery, primary_imagery } = detail;
  const analyses = layers?.analyses ?? [];
  const satellite = layers?.satellite ?? null;
  const comparisonEntries = analyses.filter((entry) => checkedAnalyses.has(entry.model_id) && entry.result?.comparison);
  const availableAnalyses = analyses.filter((entry) => entry.available).length;
  const totalImagery = imagery.pre.length + imagery.post.length;

  return (
    <div className="disaster-shell disaster-detail-shell">
      <div className="disaster-topbar">
        <Link to="/pemetaan-bencana" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left" /> {t("disaster.detail.backToList")}
        </Link>
        <div className="disaster-topbar-actions">
          <span>{user?.username}</span>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={logout}>
            <i className="bi bi-box-arrow-right" /> {t("common.logout")}
          </button>
        </div>
      </div>

      {/* 1. Header */}
      <section className="disaster-detail-hero">
        <div className="disaster-detail-title">
          <div className="disaster-card-badges">
            <span className="badge text-bg-primary">
              <i className={`bi ${typeIcon(event.disaster_type)}`} />{" "}
              {EVENT_DISASTER_TYPE_LABELS[event.disaster_type as EventDisasterType] ||
                event.disaster_type}
            </span>
            {event.severity && (
              <span className={`badge ${severityBadgeClass(event.severity)}`}>
                {SEVERITY_LABELS[event.severity as EventSeverity]}
              </span>
            )}
            <span className="disaster-muted-chip">
              <i className="bi bi-calendar3" /> {event.event_date || "-"}
            </span>
          </div>
          <h1>{event.name}</h1>
          <p className="disaster-detail-location">
            <i className="bi bi-geo-alt" />{" "}
            {[event.location_name, event.province?.join(", "), event.district?.join(", ")]
              .filter(Boolean)
              .join(" - ")}
          </p>
          {event.description && <p className="disaster-detail-description">{event.description}</p>}
        </div>
        <div className="disaster-detail-facts">
          <div>
            <i className="bi bi-bounding-box-circles" />
            <span>{t("disaster.detail.aoi")}</span>
            <strong>
              {aoi?.area_ha != null
                ? `${aoi.area_ha.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ha`
                : "-"}
            </strong>
          </div>
          <div>
            <i className="bi bi-images" />
            <span>{t("disaster.detail.imagery")}</span>
            <strong>{totalImagery}</strong>
          </div>
          <div>
            <i className="bi bi-diagram-3" />
            <span>{t("disaster.detail.analysis")}</span>
            <strong>{availableAnalyses}</strong>
          </div>
        </div>
      </section>

      {layersError && <div className="alert alert-warning py-2 mb-3">{layersError}</div>}
      {analyses.some((entry) => !entry.available) && (
        <div className="alert alert-secondary py-2 mb-3 small">
          <i className="bi bi-info-circle me-1" />
          Analisis yang belum kompatibel atau belum tersedia tidak ditampilkan sebagai layer valid. {analyses.filter((entry) => !entry.available && entry.availability_reason?.length).map((entry) => `${entry.user_label}: ${entry.availability_reason?.join("; ")}`).join(" | ")}
        </div>
      )}

      <section className="disaster-workspace">
        {/* Layer panel and the single satellite viewer share this row. */}
        <aside className="disaster-side-rail">
          <LayerPanel
            satellite={satellite}
            analyses={analyses}
            checkedAnalyses={checkedAnalyses}
            onToggleAnalysis={toggleAnalysis}
            showSatellite={showSatellite}
            onToggleSatellite={() => setShowSatellite((v) => !v)}
            showAoi={showAoi}
            onToggleAoi={() => setShowAoi((v) => !v)}
            showHotspots={showHotspots}
            onToggleHotspots={() => setShowHotspots((v) => !v)}
          />
          <HotspotPanel
            hotspots={hotspots}
            highlightedHotspotId={highlightedHotspotId}
            onZoom={handleHotspotZoom}
            onHighlight={handleHotspotHighlight}
          />
          {isKarhutla && (
            <FirmsHotspotPanel aoi={aoi} onChange={setFirmsLayer} onZoom={handleFirmsZoom} />
          )}
          {hotspotsLoading && <div className="text-muted small mb-3">{t("disaster.detail.hotspotsLoading")}</div>}
          {hotspotsError && <div className="alert alert-warning py-2 mb-3">{hotspotsError}</div>}
        </aside>

        {/* The old duplicate analysis map is intentionally removed. */}
        <div className="disaster-map-column">
          {comparisonEntries.map((entry, index) => <SegmentationComparison key={`${entry.model_id}-${entry.run?.id}`} result={entry.result!.comparison!} showGlobeControl={index === 0} />)}
          <SatelliteViewer
            aoi={aoi}
            imagery={imagery}
            primaryImagery={primary_imagery}
            satellite={satellite}
            showSatellite={showSatellite}
            analyses={analyses.filter(entry => !entry.result?.comparison)}
            checkedAnalyses={checkedAnalyses}
            showGlobeControl={comparisonEntries.length === 0}
            showAoi={showAoi}
            hotspots={hotspots}
            showHotspots={showHotspots}
            highlightedHotspotId={highlightedHotspotId}
            onHotspotClick={handleHotspotHighlight}
            firmsFeatures={isKarhutla && firmsLayer.enabled ? firmsLayer.features : []}
            firmsShowLabels={isKarhutla && firmsLayer.showLabels}
            firmsCluster={isKarhutla ? firmsLayer.cluster : true}
            focusFeature={focusFeature}
            focusSignal={focusSignal}
          />
        </div>
      </section>

      {/* 4. KPI tiles */}
      <div className="disaster-section-heading">
        <div>
          <span>{t("disaster.detail.analysisResults")}</span>
          <h2>{t("disaster.detail.impactStats")}</h2>
        </div>
        <i className="bi bi-bar-chart-fill" />
      </div>
      {statsLoading ? (
        <div className="alert alert-info py-2">
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          />
          {t("disaster.detail.statsLoading")}
        </div>
      ) : statsError ? (
        <div className="alert alert-warning py-2">{statsError}</div>
      ) : statistics ? (
        <>
          {statistics.event && (
            <div className="alert alert-info py-2 small mb-3">
              <i className="bi bi-shield-check me-1" /> Statistik tervalidasi untuk kejadian <strong>{EVENT_DISASTER_TYPE_LABELS[statistics.event.disaster_type as EventDisasterType] ?? statistics.event.disaster_type}</strong> — {statistics.event.name}. Hanya model yang kompatibel dengan jenis bencana ini yang ditampilkan.
            </div>
          )}
          <KpiTiles kpis={statistics.kpis} analyses={analyses} />

          {/* 9. Cross-layer stat card - only rendered if the backend actually returned entries */}
          {statistics.cross_layer.length > 0 && (
            <div className="card mb-3 disaster-modern-card">
              <div className="card-header py-2 disaster-soft-header">
                <i className="bi bi-intersect" /> {t("disaster.detail.crossLayer")}
              </div>
              <div className="card-body">
                {statistics.cross_layer.map((stat, idx) => (
                  <div key={idx} className="mb-2">
                    <div className="fw-semibold small">{stat.label}</div>
                    <div className="small text-muted">
                      {Object.entries(stat)
                        .filter(([key]) => key !== "layers" && key !== "label")
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(" - ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. Statistics charts */}
          <StatisticsPanel kpis={statistics.kpis} analyses={analyses} />
        </>
      ) : null}

      {/* Additional Sources - legacy BMKG/InaRISK/DEMNAS panels, collapsed */}
      <div className="card mt-3 disaster-modern-card">
        <button
          type="button"
          className="card-header py-2 d-flex align-items-center justify-content-between w-100 border-0 bg-transparent text-start disaster-soft-header"
          onClick={() => setAdditionalSourcesOpen((v) => !v)}
        >
          <span>
            <i className="bi bi-database-fill" /> {t("disaster.detail.additionalSources")}
          </span>
          <i className={`bi ${additionalSourcesOpen ? "bi-chevron-up" : "bi-chevron-down"}`} />
        </button>
        {additionalSourcesOpen && (
          <div className="card-body">
            <div className="d-flex gap-2 flex-wrap mb-3">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={handleLoadSources}
                disabled={sourcesLoading}
              >
                <i className="bi bi-database-fill" /> {t("disaster.detail.loadOfficial")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-info"
                onClick={handleLoadBmkg}
                disabled={alertsLoading}
              >
                <i className="bi bi-cloud-rain-heavy-fill" /> {t("disaster.detail.bmkgAlerts")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleLoadDem}
                disabled={demLoading}
              >
                <i className="bi bi-triangle-fill" /> {t("disaster.detail.demSlope")}
              </button>
            </div>
            <SourceStatusPanel loading={sourcesLoading} error={sourcesError} sources={sources} />
            <BmkgAlerts loading={alertsLoading} error={alertsError} alerts={alerts} />
            <DemSlopeControls loading={demLoading} error={demError} result={demResult} />
          </div>
        )}
      </div>
    </div>
  );
}
