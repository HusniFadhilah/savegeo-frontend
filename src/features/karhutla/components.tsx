import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import MapView from "@/components/map/MapView";
import MapExportControl from "@/components/map/MapExportControl";
import MapHeightResizeHandle from "@/components/map/MapHeightResizeHandle";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import { useI18nStore } from "@/hooks/useI18nStore";
import { formatDate, formatNumber, translate } from "@/hooks/useI18nStore";
import { ApiError, apiClient } from "@/services/apiClient";
import { fetchCities, fetchDistricts, fetchProvinces, fetchVillages } from "@/services/analysisService";
import {
  fetchWildfireEvent,
  fetchWildfireEvents,
  fetchWildfireHotspots,
  fetchWildfireRegionStatistics,
  syncWildfireHotspots,
} from "@/features/disaster/api";
import { FALLBACK_KALIMANTAN_TIMELINE, FALLBACK_WILDFIRE_EVENTS } from "./data";
import { isConfirmedWildfireEventForRoute } from "./eventAvailability";
import { parseWildfireQuery, writeWildfireQuery, type WildfireQueryState } from "./queryState";
import type {
  WildfireEvent,
  WildfireFilters,
  WildfireSummary,
  WildfireTimelineChart,
  WildfireTimelinePoint,
  WildfireTimelineSort,
  WildfireRegionLevel,
  WildfireRegionStatistic,
} from "./types";
import type { RegionOption } from "@/types/api";
import type { FirmsHotspotFeature } from "@/features/disaster/types";
import type { DisasterEventListItem } from "@/features/disaster/types";
import WindArrowLayer from "./WindArrowLayer";
import WildfireLayerPanel from "./WildfireLayerPanel";

function statusLabel(status: WildfireEvent["status"], language: "id" | "en") {
  const labels =
    language === "id"
      ? {
          active: "Aktif",
          monitoring: "Dalam pemantauan",
          completed: "Selesai",
          archived: "Diarsipkan",
        }
      : {
          active: "Active",
          monitoring: "Monitoring",
          completed: "Completed",
          archived: "Archived",
        };
  return labels[status];
}

function matchRegionOption(options: RegionOption[], name: string): RegionOption | undefined {
  const normalized = name.trim().toLocaleLowerCase();
  return normalized
    ? options.find((option) => option.name.trim().toLocaleLowerCase() === normalized)
    : undefined;
}

function LanguageToggle() {
  const { language, setLanguage } = useI18nStore();
  return (
    <button
      type="button"
      className="wildfire-language-toggle"
      aria-label="Switch language"
      onClick={() => setLanguage(language === "id" ? "en" : "id")}
    >
      {language.toUpperCase()}
    </button>
  );
}

function periodLabel(event: WildfireEvent, language: "id" | "en") {
  const start = formatDate(event.monitoring_from || event.start_date, language);
  const endValue = event.monitoring_to || event.end_date || event.last_data_at;
  const end = endValue
    ? formatDate(endValue, language)
    : language === "id"
      ? "sekarang"
      : "present";
  return `${start} – ${end}`;
}

function completeTimeline(
  points: WildfireTimelinePoint[],
  startDate: string,
  endDate: string,
): WildfireTimelinePoint[] {
  if (!startDate || !endDate) return points;
  const counts = new Map(points.map((point) => [point.date, point.count]));
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const result: WildfireTimelinePoint[] = [];
  while (cursor <= end && result.length < 366) {
    const date = cursor.toISOString().slice(0, 10);
    result.push({ date, count: counts.get(date) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

type TimelinePreset = "all" | "today" | "7d" | "30d" | "date" | "range";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shiftIsoDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function timelineTickLabel(value: string, language: "id" | "en") {
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function TimelineChart({
  data,
  chartType,
  sort,
  language,
}: {
  data: WildfireTimelinePoint[];
  chartType: WildfireTimelineChart;
  sort: WildfireTimelineSort;
  language: "id" | "en";
}) {
  const maxValue = Math.max(1, ...data.map((point) => point.count));
  const peakValue = Math.max(0, ...data.map((point) => point.count));
  const labelStep = Math.max(1, Math.ceil(data.length / 8));
  const axisPoints = data.filter(
    (_, index) => index % labelStep === 0 || index === data.length - 1,
  );
  const plotWidth = 1000;
  const plotHeight = 220;
  const xPadding = 18;
  const yPadding = 14;
  const baseline = plotHeight - yPadding;
  const points = data.map((point, index) => ({
    ...point,
    x:
      data.length === 1
        ? plotWidth / 2
        : xPadding + (index / (data.length - 1)) * (plotWidth - xPadding * 2),
    y: baseline - (point.count / maxValue) * (baseline - yPadding),
  }));
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaString = points.length
    ? `${points[0].x},${baseline} ${pointString} ${points[points.length - 1].x},${baseline}`
    : "";
  const sortLabel =
    sort === "date-desc"
      ? language === "id"
        ? "tanggal terbaru ke terlama"
        : "newest to oldest"
      : sort === "count-desc"
        ? language === "id"
          ? "jumlah terbanyak ke tersedikit"
          : "highest to lowest count"
        : sort === "count-asc"
          ? language === "id"
            ? "jumlah tersedikit ke terbanyak"
            : "lowest to highest count"
          : language === "id"
            ? "tanggal terlama ke terbaru"
            : "oldest to newest";

  return (
    <>
      <div className="wildfire-timeline-plot-shell">
        <div className="wildfire-chart-y-axis" aria-hidden="true">
          <span>{formatNumber(maxValue, language)}</span>
          <span>{formatNumber(Math.round(maxValue / 2), language)}</span>
          <span>0</span>
        </div>
        {chartType === "bar" ? (
          <div className="wildfire-histogram" role="group" aria-label={sortLabel}>
            {data.map((point) => (
              <button
                type="button"
                key={point.date}
                className={
                  point.count === peakValue
                    ? "wildfire-histogram-bar is-peak"
                    : "wildfire-histogram-bar"
                }
                title={`${timelineTickLabel(point.date, language)}: ${formatNumber(point.count, language)} hotspot`}
                aria-label={`${point.date}: ${formatNumber(point.count, language)} hotspot`}
                style={{
                  height:
                    point.count === 0
                      ? "3px"
                      : `${Math.max(5, (point.count / maxValue) * 100)}%`,
                }}
              >
                <span className="wildfire-histogram-value">
                  {formatNumber(point.count, language)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="wildfire-line-chart" role="img" aria-label={sortLabel}>
            <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} preserveAspectRatio="none">
              <title>{sortLabel}</title>
              {[0, 0.5, 1].map((ratio) => (
                <line
                  key={ratio}
                  x1={0}
                  x2={plotWidth}
                  y1={yPadding + (baseline - yPadding) * ratio}
                  y2={yPadding + (baseline - yPadding) * ratio}
                  className="wildfire-chart-grid-line"
                />
              ))}
              {chartType === "area" && areaString && (
                <polygon points={areaString} className="wildfire-chart-area" />
              )}
              {pointString && <polyline points={pointString} className="wildfire-chart-line" />}
              {points.map((point) => (
                <circle key={point.date} cx={point.x} cy={point.y} r="4" className="wildfire-chart-point">
                  <title>
                    {timelineTickLabel(point.date, language)}: {formatNumber(point.count, language)} hotspot
                  </title>
                </circle>
              ))}
            </svg>
          </div>
        )}
      </div>
      <div className="wildfire-timeline-axis" aria-hidden="true">
        {axisPoints.map((point) => (
          <span
            key={point.date}
            className="is-visible"
            title={formatDate(point.date, language)}
          >
            {timelineTickLabel(point.date, language)}
          </span>
        ))}
      </div>
      <div className="wildfire-timeline-axis-caption">
        <span>{language === "id" ? "Tanggal akuisisi (UTC)" : "Acquisition date (UTC)"}</span>
        <span>{sortLabel}</span>
      </div>
    </>
  );
}

function summaryFromEvent(event: WildfireEvent): WildfireSummary {
  return {
    total_hotspots: event.hotspot_count,
    high_confidence_hotspots: event.high_confidence_count,
    nominal_confidence_hotspots: Math.max(0, event.hotspot_count - event.high_confidence_count),
    low_confidence_hotspots: 0,
    affected_regions: event.provinces.length,
    total_frp: null,
    average_frp: null,
    latest_acquisition_time: event.last_data_at,
    burned_area_ha: event.burned_area_ha,
    burned_area_source: event.burned_area_source,
    previous_period_change_pct: null,
  };
}

export function WildfireStatusBadge({ event }: { event: WildfireEvent }) {
  const language = useI18nStore((state) => state.language);
  return (
    <span className={`wildfire-status wildfire-status-${event.status}`}>
      <span aria-hidden="true" />
      {statusLabel(event.status, language)}
    </span>
  );
}

export function KarhutlaOverviewCard({
  event,
  loading = false,
}: {
  event: WildfireEvent;
  loading?: boolean;
}) {
  const { t, language } = useI18nStore();
  return (
    <section
      className={`wildfire-overview-card${loading ? " is-loading" : ""}`}
      aria-labelledby="wildfire-overview-title"
      aria-busy={loading}
    >
      <div
        className="wildfire-overview-visual"
        role="img"
        aria-label={t("wildfire.overview.mapAlt")}
      >
        <div className="wildfire-preview-grid" />
        <i className="bi bi-fire" aria-hidden="true" />
        <span>
          {event.provinces.length} {t("wildfire.overview.provinces")}
        </span>
      </div>
      <div className="wildfire-overview-content">
        <div className="wildfire-eyebrow">{t("wildfire.category")}</div>
        <div className="wildfire-title-row">
          <h2 id="wildfire-overview-title">{event.title}</h2>
          <WildfireStatusBadge event={event} />
        </div>
        <p className="wildfire-muted">{event.description}</p>
        <div className="wildfire-overview-metrics">
          <div>
            {loading ? (
              <OverviewValueSkeleton label={t("wildfire.stats.hotspots")} loadingLabel={t("wildfire.loading")} />
            ) : (
              <strong>{formatNumber(event.hotspot_count, language)}</strong>
            )}
            <span>{t("wildfire.stats.hotspots")}</span>
          </div>
          <div>
            {loading ? (
              <OverviewValueSkeleton label={t("wildfire.stats.highConfidence")} loadingLabel={t("wildfire.loading")} />
            ) : (
              <strong>{formatNumber(event.high_confidence_count, language)}</strong>
            )}
            <span>{t("wildfire.stats.highConfidence")}</span>
          </div>
          <div>
            {loading ? (
              <OverviewValueSkeleton label={t("wildfire.stats.burnedArea")} loadingLabel={t("wildfire.loading")} />
            ) : (
              <strong>
                {event.burned_area_ha == null
                  ? "—"
                  : `${formatNumber(event.burned_area_ha, language, { maximumFractionDigits: 0 })} ha`}
              </strong>
            )}
            <span>{t("wildfire.stats.burnedArea")}</span>
          </div>
        </div>
        <div className="wildfire-card-meta">
          <span>
            <i className="bi bi-calendar3" /> {periodLabel(event, language)}
          </span>
          <span>
            <i className="bi bi-clock" />{" "}
            {event.last_data_at ? formatDate(event.last_data_at, language, true) : "—"}
          </span>
        </div>
        <div className="wildfire-card-actions">
          <Link className="btn btn-primary" to={`/pemetaan-bencana/karhutla/${event.slug}`}>
            {t("wildfire.overview.more")}
          </Link>
          <Link className="wildfire-secondary-link" to="/pemetaan-bencana/karhutla">
            {t("wildfire.overview.allEvents")} <i className="bi bi-arrow-up-right" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function OverviewValueSkeleton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  return (
    <span
      className="wildfire-overview-value-skeleton"
      role="status"
      aria-label={`${label}: ${loadingLabel}`}
    />
  );
}

function EventSummaryMap({ events }: { events: WildfireEvent[] }) {
  const navigate = useNavigate();
  const mapShellRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={mapShellRef} className="wildfire-summary-map" aria-label="Peta ringkasan kejadian karhutla">
      <MapContainer
        center={[-1.7, 113.4]}
        zoom={4}
        scrollWheelZoom={false}
        zoomControl={false}
        dragging={false}
        doubleClickZoom={false}
        className="savegeo-map"
      >
        <MapExportControl mapTitle="Ringkasan Karhutla" />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />
        {events.map((event) => (
          <CircleMarker
            key={event.slug}
            center={[event.center_lat, event.center_lon]}
            radius={Math.max(7, Math.min(16, event.hotspot_count / 700))}
            pathOptions={{ color: "#ff6b35", fillColor: "#ff9f1c", fillOpacity: 0.75, weight: 2 }}
            eventHandlers={{ click: () => navigate(`/pemetaan-bencana/karhutla/${event.slug}`) }}
          >
            <Popup>
              <strong>{event.title}</strong>
              <br />
              {event.hotspot_count.toLocaleString("id-ID")} hotspots
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <MapHeightResizeHandle mapShellRef={mapShellRef} />
    </div>
  );
}

export function KarhutlaIndexPage() {
  const { t, language } = useI18nStore();
  const [events, setEvents] = useState<WildfireEvent[]>(FALLBACK_WILDFIRE_EVENTS);
  const [filters, setFilters] = useState<WildfireFilters>({
    search: "",
    year: "",
    status: "",
    province: "",
    severity: "",
    sort: "latest",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWildfireEvents(filters)
      .then((response) => {
        if (!cancelled && response.events.length) setEvents(response.events.map(adaptLegacyEvent));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t("wildfire.errors.load"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, t]);

  const filtered = useMemo(
    () =>
      events
        .filter((event) => {
          const haystack = `${event.title} ${event.provinces.join(" ")}`.toLowerCase();
          return (
            (!filters.search || haystack.includes(filters.search.toLowerCase())) &&
            (!filters.year || String(event.year) === filters.year) &&
            (!filters.status || event.status === filters.status) &&
            (!filters.province || event.provinces.includes(filters.province)) &&
            (!filters.severity || event.severity === filters.severity)
          );
        })
        .sort((a, b) =>
          filters.sort === "hotspots"
            ? b.hotspot_count - a.hotspot_count
            : filters.sort === "region"
              ? a.provinces[0].localeCompare(b.provinces[0])
              : String(b.updated_at).localeCompare(String(a.updated_at)),
        ),
    [events, filters],
  );
  const provinceOptions = [...new Set(events.flatMap((event) => event.provinces))].sort();

  return (
    <div className="wildfire-shell">
      <div className="wildfire-page-header">
        <div>
          <Link className="wildfire-back-link" to="/pemetaan-bencana">
            <i className="bi bi-arrow-left" /> {t("wildfire.backOverview")}
          </Link>
          <div className="wildfire-eyebrow">{t("wildfire.category")}</div>
          <h1>{t("wildfire.index.title")}</h1>
          <p>{t("wildfire.index.description")}</p>
        </div>
        <div className="wildfire-header-tools">
          <LanguageToggle />
          <div className="wildfire-last-sync">
            <i className="bi bi-arrow-repeat" /> {t("wildfire.updated")}{" "}
            {formatDate(events[0]?.updated_at ?? new Date(), language, true)}
          </div>
        </div>
      </div>
      <div className="wildfire-index-layout">
        <EventSummaryMap events={filtered} />
        <aside className="wildfire-event-list-panel">
          <div className="wildfire-panel-heading">
            <h2>{t("wildfire.index.events")}</h2>
            <span>{filtered.length}</span>
          </div>
          <div className="wildfire-filter-row">
            <label className="visually-hidden" htmlFor="wildfire-search">
              {t("wildfire.filters.search")}
            </label>
            <div className="wildfire-search">
              <i className="bi bi-search" />
              <input
                id="wildfire-search"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder={t("wildfire.filters.searchPlaceholder")}
              />
            </div>
            <select
              aria-label={t("wildfire.filters.status")}
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">{t("wildfire.filters.allStatus")}</option>
              <option value="active">{statusLabel("active", language)}</option>
              <option value="monitoring">{statusLabel("monitoring", language)}</option>
              <option value="completed">{statusLabel("completed", language)}</option>
              <option value="archived">{statusLabel("archived", language)}</option>
            </select>
          </div>
          <div className="wildfire-filter-row">
            <select
              aria-label={t("wildfire.filters.year")}
              value={filters.year}
              onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
            >
              <option value="">{t("wildfire.filters.allYears")}</option>
              {[...new Set(events.map((e) => e.year))]
                .sort((a, b) => b - a)
                .map((year) => (
                  <option key={year}>{year}</option>
                ))}
            </select>
            <select
              aria-label={t("wildfire.filters.province")}
              value={filters.province}
              onChange={(e) => setFilters((f) => ({ ...f, province: e.target.value }))}
            >
              <option value="">{t("wildfire.filters.allProvinces")}</option>
              {provinceOptions.map((province) => (
                <option key={province}>{province}</option>
              ))}
            </select>
            <select
              aria-label={t("wildfire.filters.sort")}
              value={filters.sort}
              onChange={(e) =>
                setFilters((f) => ({ ...f, sort: e.target.value as WildfireFilters["sort"] }))
              }
            >
              <option value="latest">{t("wildfire.filters.latest")}</option>
              <option value="hotspots">{t("wildfire.filters.mostHotspots")}</option>
              <option value="region">{t("wildfire.filters.region")}</option>
            </select>
          </div>
          {loading && (
            <div className="wildfire-inline-status" role="status">
              <span className="spinner-border spinner-border-sm" /> {t("wildfire.loading")}
            </div>
          )}
          {error && <div className="alert alert-warning py-2">{error}</div>}
          {!loading && !filtered.length && (
            <div className="wildfire-empty">
              <i className="bi bi-binoculars" />
              <strong>{t("wildfire.empty.title")}</strong>
              <span>{t("wildfire.empty.description")}</span>
            </div>
          )}
          <div className="wildfire-event-cards">
            {filtered.map((event) => (
              <article className="wildfire-event-row" key={event.slug}>
                <div className="wildfire-event-row-icon">
                  <i className="bi bi-fire" />
                </div>
                <div className="wildfire-event-row-copy">
                  <div className="wildfire-title-row">
                    <h3>{event.title}</h3>
                    <WildfireStatusBadge event={event} />
                  </div>
                  <p>
                    {event.provinces.join(", ")} · {periodLabel(event, language)}
                  </p>
                  <div className="wildfire-row-stats">
                    <span>
                      <strong>{formatNumber(event.hotspot_count, language)}</strong>{" "}
                      {t("wildfire.stats.hotspots")}
                    </span>
                    <span>
                      <strong>{formatNumber(event.high_confidence_count, language)}</strong>{" "}
                      {t("wildfire.stats.highConfidence")}
                    </span>
                  </div>
                  <Link
                    className="wildfire-row-link"
                    to={`/pemetaan-bencana/karhutla/${event.slug}`}
                  >
                    {t("wildfire.index.openDetail")} <i className="bi bi-arrow-right" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

interface HotspotMapProps {
  event: WildfireEvent;
  features: FirmsHotspotFeature[];
  query: WildfireQueryState;
  onSelect: (feature: FirmsHotspotFeature) => void;
  onToggleLayer: (layer: string) => void;
  onSync: () => void;
  syncing: boolean;
  syncError: string | null;
  dataRevision: number;
}

function HotspotMap({
  event,
  features,
  query,
  onSelect,
  onToggleLayer,
  onSync,
  syncing,
  syncError,
  dataRevision,
}: HotspotMapProps) {
  const [boundary, setBoundary] = useState<GeoJSON.GeoJSON | null>(null);
  const [boundaryFailed, setBoundaryFailed] = useState(false);
  const [viirsFeatures, setViirsFeatures] = useState<FirmsHotspotFeature[]>([]);
  const [viirsAvailable, setViirsAvailable] = useState<boolean | null>(null);
  const viirsEnabled = query.layers.includes("viirs");
  const hotspotEnabled = query.layers.includes("hotspot");
  const boundaryEnabled = query.layers.includes("boundary");
  const provinceCodeKey = event.province_codes.join(",");
  const selectedRegion = query.villageCode
    ? { level: "village" as const, code: query.villageCode }
    : query.districtCode
      ? { level: "district" as const, code: query.districtCode }
      : query.cityCode
        ? { level: "city" as const, code: query.cityCode }
        : query.provinceCode
          ? { level: "province" as const, code: query.provinceCode }
          : null;

  useEffect(() => {
    if (!boundaryEnabled) {
      setBoundary(null);
      setBoundaryFailed(false);
      return undefined;
    }
    let cancelled = false;
    setBoundaryFailed(false);
    const selectedBoundary = selectedRegion
      ? fetchRegionGeometry(selectedRegion.level, selectedRegion.code).then((geometry) => {
          const features = geometry.type === "FeatureCollection"
            ? geometry.features
            : geometry.type === "Feature"
              ? [geometry]
              : [{ type: "Feature", geometry, properties: { code: selectedRegion.code } } as GeoJSON.Feature];
          return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
        })
      : (async () => {
          const provinces = await fetchProvinces();
          const legacyProvince = query.province
            ? provinces.find((item) => item.name === query.province)
            : null;
          const codes = legacyProvince ? [legacyProvince.code] : provinceCodeKey.split(",").filter(Boolean);
          const results = await Promise.allSettled(codes.map((code) => fetchRegionGeometry("province", code)));
          const features = results.flatMap((result, index) => {
            if (result.status !== "fulfilled") return [];
            const geometry = result.value as GeoJSON.GeoJSON;
            if (geometry.type === "FeatureCollection") return geometry.features;
            if (geometry.type === "Feature") return [geometry];
            return [
              { type: "Feature", geometry, properties: { code: codes[index] } } as GeoJSON.Feature,
            ];
          });
          if (!features.length) throw new Error("missing");
          return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
        })();
    selectedBoundary
      .then((collection) => {
        if (!cancelled) setBoundary(collection);
      })
      .catch(() => {
        if (!cancelled) {
          setBoundary(null);
          setBoundaryFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boundaryEnabled, provinceCodeKey, query.province, selectedRegion?.code, selectedRegion?.level]);

  useEffect(() => {
    if (!viirsEnabled) {
      setViirsFeatures([]);
      setViirsAvailable(null);
      return undefined;
    }
    let cancelled = false;
    const from = query.from || event.monitoring_from || event.start_date;
    const to = query.to || event.last_data_at?.slice(0, 10) || from;
    fetchWildfireHotspots(event.slug, {
      from,
      to,
      sensor: "viirs",
      confidence: "low,nominal,high",
      region_level: selectedRegion?.level,
      region_code: selectedRegion?.code,
    })
      .then((response) => {
        if (cancelled) return;
        setViirsAvailable(true);
        setViirsFeatures(response.features);
      })
      .catch(() => {
        if (!cancelled) {
          setViirsAvailable(false);
          setViirsFeatures([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    dataRevision,
    event.last_data_at,
    event.monitoring_from,
    event.slug,
    event.start_date,
    query.from,
    query.to,
    viirsEnabled,
    selectedRegion?.code,
    selectedRegion?.level,
  ]);

  const windDate = query.from || event.monitoring_from || event.start_date;
  return (
    <div className="wildfire-map-wrap">
      <MapView
        id="wildfire-detail-map"
        center={
          query.lat != null && query.lng != null
            ? [query.lat, query.lng]
            : [event.center_lat, event.center_lon]
        }
        zoom={query.zoom ?? event.default_zoom}
        showGlobeControl={false}
        historicalDate={windDate}
        preferCanvas
      >
        <BasemapSwitcher />
        <FitBoundaryToMap boundary={boundary} focusKey={`${selectedRegion?.level ?? "event"}:${selectedRegion?.code ?? provinceCodeKey}`} />
        <WildfireLayerPanel
          query={query}
          onToggleLayer={onToggleLayer}
          viirsAvailable={viirsAvailable}
          onSync={onSync}
          syncing={syncing}
          syncError={syncError}
        />
        {boundary && query.layers.includes("boundary") && (
          <GeoJSON
            data={boundary as GeoJSON.GeoJsonObject}
            style={{ color: "#43d9b2", weight: 2, fillOpacity: 0.05 }}
          />
        )}
        {query.layers.includes("wind") && <WindArrowLayer bbox={event.bbox} date={windDate} />}
        {viirsEnabled &&
          viirsAvailable &&
          viirsFeatures.map((feature) => {
            const [lng, lat] = feature.geometry.coordinates;
            return (
              <CircleMarker
                key={`viirs-${feature.properties.source}-${feature.properties.acq_datetime_utc}-${lat}-${lng}`}
                center={[lat, lng]}
                radius={6}
                pathOptions={{
                  color: "#7c3aed",
                  fillColor: "#a78bfa",
                  fillOpacity: 0.78,
                  weight: 1.5,
                }}
              >
                <Popup>
                  <div className="wildfire-popup">
                    <strong>VIIRS / NASA FIRMS · tersimpan</strong>
                    <dl>
                      <dt>Acquisition</dt>
                      <dd>{feature.properties.acq_datetime_utc ?? feature.properties.acq_date}</dd>
                      <dt>Coordinates</dt>
                      <dd>
                        {lat.toFixed(5)}, {lng.toFixed(5)}
                      </dd>
                      {feature.properties.frp != null && (
                        <>
                          <dt>FRP</dt>
                          <dd>{feature.properties.frp} MW</dd>
                        </>
                      )}
                    </dl>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        {hotspotEnabled &&
          features.map((feature, index) => {
            const [lng, lat] = feature.geometry.coordinates;
            const selected = query.hotspot === String(index);
            const highConfidence = feature.properties.confidence_label === "high";
            return (
              <CircleMarker
                key={`${feature.properties.source}-${feature.properties.acq_datetime_utc}-${index}`}
                center={[lat, lng]}
                radius={selected ? 9 : 5}
                pathOptions={{
                  color: highConfidence ? "#ff4d6d" : "#ffd166",
                  fillColor: highConfidence ? "#ff4d6d" : "#ffd166",
                  fillOpacity: 0.9,
                  weight: selected ? 3 : 1,
                }}
                eventHandlers={{ click: () => onSelect(feature) }}
              >
                <Popup closeButton>
                  <div className="wildfire-popup">
                    <strong>{highConfidence ? "High confidence" : "Hotspot"}</strong>
                    <dl>
                      <dt>Acquisition</dt>
                      <dd>{feature.properties.acq_datetime_utc ?? feature.properties.acq_date}</dd>
                      {feature.properties.satellite && (
                        <>
                          <dt>Satellite</dt>
                          <dd>{feature.properties.satellite}</dd>
                        </>
                      )}
                      {feature.properties.instrument && (
                        <>
                          <dt>Sensor</dt>
                          <dd>{feature.properties.instrument}</dd>
                        </>
                      )}
                      <dt>Coordinates</dt>
                      <dd>
                        {lat.toFixed(5)}, {lng.toFixed(5)}
                      </dd>
                      {feature.properties.frp != null && (
                        <>
                          <dt>FRP</dt>
                          <dd>{feature.properties.frp} MW</dd>
                        </>
                      )}
                    </dl>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapView>
      {boundaryFailed && (
        <div className="wildfire-map-notice" role="status">
          <i className="bi bi-info-circle" /> Batas wilayah sementara tidak tersedia. Hotspot tetap
          ditampilkan.
        </div>
      )}
      <div className="wildfire-map-legend">
        <span>
          <i className="legend-dot legend-high" /> High confidence
        </span>
        <span>
          <i className="legend-dot legend-nominal" /> Nominal / low
        </span>
        {viirsEnabled && (
          <span>
            <i className="legend-dot legend-viirs" /> VIIRS / DB
          </span>
        )}
        {query.layers.includes("wind") && (
          <span>
            <i className="legend-wind" /> Arah angin
          </span>
        )}
      </div>
    </div>
  );
}
async function fetchRegionGeometry(level: WildfireRegionLevel, code: string) {
  if (level === "province") {
    return apiClient.get<GeoJSON.GeoJSON>(`/regions/provinces/${encodeURIComponent(code)}/geometry`);
  }
  return apiClient.get<GeoJSON.GeoJSON>(
    `/regions/geometry?endpoint=${level}&code=${encodeURIComponent(code)}`,
  );
}

function FitBoundaryToMap({ boundary, focusKey }: { boundary: GeoJSON.GeoJSON | null; focusKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!boundary) return;
    const bounds = L.geoJSON(boundary as GeoJSON.GeoJsonObject).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 });
  }, [boundary, focusKey, map]);
  return null;
}

export function KarhutlaDetailPage() {
  const { t, language } = useI18nStore();
  const { eventSlug = "kalimantan-2026" } = useParams<{ eventSlug?: string }>();
  const slug = eventSlug;
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<WildfireEvent | null>(
    FALLBACK_WILDFIRE_EVENTS.find((item) => item.slug === slug) ?? null,
  );
  const [eventLookup, setEventLookup] = useState<{
    slug: string;
    status: "loading" | "ready" | "unavailable";
  }>(() => ({ slug, status: "loading" }));
  const [summary, setSummary] = useState<WildfireSummary | null>(null);
  const [features, setFeatures] = useState<FirmsHotspotFeature[]>([]);
  const [timeline, setTimeline] = useState<WildfireTimelinePoint[]>([]);
  const [query, setQuery] = useState(() => parseWildfireQuery(searchParams.toString()));
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const [dataError, setDataError] = useState<string | null>(null);
  const [mapNotice, setMapNotice] = useState<string | null>(null);
  const [timelinePreset, setTimelinePreset] = useState<TimelinePreset>(() =>
    query.from && query.from === query.to ? "date" : query.from || query.to ? "range" : "all",
  );
  const [timelineChart, setTimelineChart] = useState<WildfireTimelineChart>("bar");
  const [timelineSort, setTimelineSort] = useState<WildfireTimelineSort>("date-asc");
  const [provinceOptions, setProvinceOptions] = useState<RegionOption[]>([]);
  const [cityOptions, setCityOptions] = useState<RegionOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<RegionOption[]>([]);
  const [villageOptions, setVillageOptions] = useState<RegionOption[]>([]);
  const [regionOptionsLoading, setRegionOptionsLoading] = useState(false);
  const [cityOptionsLoading, setCityOptionsLoading] = useState(false);
  const [districtOptionsLoading, setDistrictOptionsLoading] = useState(false);
  const [villageOptionsLoading, setVillageOptionsLoading] = useState(false);
  const [regionOptionsError, setRegionOptionsError] = useState<string | null>(null);
  const [regionStatistics, setRegionStatistics] = useState<WildfireRegionStatistic[]>([]);
  const [regionStatisticsLoading, setRegionStatisticsLoading] = useState(false);
  const [regionStatisticsError, setRegionStatisticsError] = useState<string | null>(null);
  const currentEventLookupStatus = eventLookup.slug === slug ? eventLookup.status : "loading";
  const eventBackedByApi = isConfirmedWildfireEventForRoute(event?.slug, slug, currentEventLookupStatus);
  const confidenceKey = query.confidence.join(",");
  const regionStatisticsLevel: WildfireRegionLevel = query.districtCode
    ? "village"
    : query.cityCode
      ? "district"
      : query.provinceCode
        ? "city"
        : "province";
  const regionStatisticsParentCode = query.districtCode || query.cityCode || query.provinceCode || undefined;
  const selectedRegion = query.villageCode
    ? { level: "village" as const, code: query.villageCode }
    : query.districtCode
      ? { level: "district" as const, code: query.districtCode }
      : query.cityCode
        ? { level: "city" as const, code: query.cityCode }
        : query.provinceCode
          ? { level: "province" as const, code: query.provinceCode }
          : null;
  const eventProvinceCodesKey = (event?.province_codes ?? []).join(",");

  useEffect(() => {
    let cancelled = false;
    setEventLookup({ slug, status: "loading" });
    setEvent(FALLBACK_WILDFIRE_EVENTS.find((item) => item.slug === slug) ?? null);
    fetchWildfireEvent(slug)
      .then((response) => {
        if (cancelled) return;
        const apiEvent = adaptLegacyEvent(response.event);
        if (apiEvent.slug !== slug) {
          setEventLookup({ slug, status: "unavailable" });
          return;
        }
        setEvent(apiEvent);
        setEventLookup({ slug, status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setEventLookup({ slug, status: "unavailable" });
      });
    return () => { cancelled = true; };
  }, [slug]);
  useEffect(() => {
    if (!event) return undefined;
    let cancelled = false;
    setRegionOptionsLoading(true);
    setRegionOptionsError(null);
    fetchProvinces(event.slug === "kalimantan-2026" ? "Kalimantan" : undefined)
      .then((options) => {
        if (cancelled) return;
        const allowedCodes = new Set(event.province_codes ?? []);
        setProvinceOptions(allowedCodes.size ? options.filter((option) => allowedCodes.has(option.code)) : options);
      })
      .catch(() => {
        if (!cancelled) setRegionOptionsError("Daftar provinsi tidak dapat dimuat.");
      })
      .finally(() => {
        if (!cancelled) setRegionOptionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [event?.slug, eventProvinceCodesKey]);
  useEffect(() => {
    if (!query.province || query.provinceCode) return;
    const option = matchRegionOption(provinceOptions, query.province);
    if (!option) return;
    const next = { ...query, provinceCode: option.code };
    setQuery(next);
    setSearchParams(writeWildfireQuery(searchParams, next), { replace: true });
  }, [provinceOptions, query, searchParams, setSearchParams]);
  useEffect(() => {
    setCityOptions([]);
    setDistrictOptions([]);
    setVillageOptions([]);
    if (!query.provinceCode) {
      setCityOptionsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setCityOptionsLoading(true);
    setRegionOptionsError(null);
    fetchCities(query.provinceCode)
      .then((options) => { if (!cancelled) setCityOptions(options); })
      .catch(() => { if (!cancelled) setRegionOptionsError("Daftar kabupaten/kota tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setCityOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [query.provinceCode]);
  useEffect(() => {
    if (!query.city || query.cityCode) return;
    const option = matchRegionOption(cityOptions, query.city);
    if (!option) return;
    const next = { ...query, cityCode: option.code };
    setQuery(next);
    setSearchParams(writeWildfireQuery(searchParams, next), { replace: true });
  }, [cityOptions, query, searchParams, setSearchParams]);
  useEffect(() => {
    setDistrictOptions([]);
    setVillageOptions([]);
    if (!query.cityCode) {
      setDistrictOptionsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setDistrictOptionsLoading(true);
    setRegionOptionsError(null);
    fetchDistricts(query.cityCode)
      .then((options) => { if (!cancelled) setDistrictOptions(options); })
      .catch(() => { if (!cancelled) setRegionOptionsError("Daftar kecamatan tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setDistrictOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [query.cityCode]);
  useEffect(() => {
    if (!query.district || query.districtCode) return;
    const option = matchRegionOption(districtOptions, query.district);
    if (!option) return;
    const next = { ...query, districtCode: option.code };
    setQuery(next);
    setSearchParams(writeWildfireQuery(searchParams, next), { replace: true });
  }, [districtOptions, query, searchParams, setSearchParams]);
  useEffect(() => {
    setVillageOptions([]);
    if (!query.districtCode) {
      setVillageOptionsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setVillageOptionsLoading(true);
    setRegionOptionsError(null);
    fetchVillages(query.districtCode)
      .then((options) => { if (!cancelled) setVillageOptions(options); })
      .catch(() => { if (!cancelled) setRegionOptionsError("Daftar kelurahan/desa tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setVillageOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [query.districtCode]);
  useEffect(() => {
    if (!query.village || query.villageCode) return;
    const option = matchRegionOption(villageOptions, query.village);
    if (!option) return;
    const next = { ...query, villageCode: option.code };
    setQuery(next);
    setSearchParams(writeWildfireQuery(searchParams, next), { replace: true });
  }, [query, searchParams, setSearchParams, villageOptions]);
  useEffect(() => {
    if (!event) return;
    if (currentEventLookupStatus === "loading") return;
    if (!eventBackedByApi) {
      setLoading(false);
      setDataError(translate("wildfire.errors.eventUnavailable", language));
      setMapNotice(null);
      setSummary(summaryFromEvent(event));
      setFeatures([]);
      setTimeline([]);
      return;
    }
    const from = query.from || event.monitoring_from;
    const to =
      query.to || event.last_data_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    let cancelled = false;
    setLoading(true);
    setDataError(null);
    setMapNotice(null);
    setSummary(null);
    setFeatures([]);
    setTimeline([]);
    fetchWildfireHotspots(event.slug, {
      from,
      to,
      sensor: query.sensor === "all" ? undefined : query.sensor,
      confidence: confidenceKey,
      region_level: selectedRegion?.level,
      region_code: selectedRegion?.code,
    })
      .then((hotspotResponse) => {
        if (cancelled) return;
        setDataError(null);
        setMapNotice(
          hotspotResponse.metadata.truncated_for_map
            ? `Peta menampilkan ${formatNumber(hotspotResponse.metadata.returned_features ?? hotspotResponse.features.length, language)} titik dari ${formatNumber(hotspotResponse.metadata.total_features ?? hotspotResponse.summary.total_hotspots, language)} data tersimpan.`
            : null,
        );
        setSummary(hotspotResponse.summary);
        setFeatures(hotspotResponse.features);
        setTimeline(hotspotResponse.timeline ?? []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setDataError(
          error instanceof ApiError ? error.message : "Data hotspot tidak dapat dimuat.",
        );
        setMapNotice(null);
        setSummary(summaryFromEvent(event));
        setFeatures([]);
        setTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event, currentEventLookupStatus, eventBackedByApi, query.from, query.to, query.sensor, confidenceKey, language, selectedRegion?.level, selectedRegion?.code]);
  useEffect(() => {
    if (!event) return;
    if (currentEventLookupStatus === "loading") {
      setRegionStatisticsLoading(true);
      setRegionStatisticsError(null);
      return;
    }
    if (!eventBackedByApi) {
      setRegionStatistics([]);
      setRegionStatisticsLoading(false);
      setRegionStatisticsError(null);
      return;
    }
    let cancelled = false;
    const from = query.from || event.monitoring_from;
    const to = query.to || event.last_data_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    setRegionStatisticsLoading(true);
    setRegionStatisticsError(null);
    setRegionStatistics([]);
    fetchWildfireRegionStatistics(event.slug, {
      level: regionStatisticsLevel,
      parent_code: regionStatisticsParentCode,
      from,
      to,
      sensor: query.sensor === "all" ? undefined : query.sensor,
      confidence: confidenceKey,
    })
      .then((response) => { if (!cancelled) setRegionStatistics(response.regions); })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRegionStatistics([]);
          setRegionStatisticsError(error instanceof ApiError ? error.message : "Statistik wilayah tidak dapat dimuat.");
        }
      })
      .finally(() => { if (!cancelled) setRegionStatisticsLoading(false); });
    return () => { cancelled = true; };
  }, [event, currentEventLookupStatus, eventBackedByApi, query.from, query.to, query.sensor, confidenceKey, regionStatisticsLevel, regionStatisticsParentCode, dataRevision]);
  const syncData = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await syncWildfireHotspots(slug, {
        from_date: query.from || event?.monitoring_from,
        to_date:
          query.to ||
          event?.monitoring_to ||
          event?.end_date ||
          new Date().toISOString().slice(0, 10),
      });
      const refreshed = await fetchWildfireEvent(slug);
      setEvent(adaptLegacyEvent(refreshed.event));
      setDataRevision((revision) => revision + 1);
    } catch (error: unknown) {
      setSyncError(error instanceof ApiError ? error.message : "Sinkronisasi NASA FIRMS gagal.");
    } finally {
      setSyncing(false);
    }
  };
  const updateQuery = (next: Partial<WildfireQueryState>) => {
    const merged = { ...query, ...next };
    setQuery(merged);
    setSearchParams(writeWildfireQuery(searchParams, merged), { replace: true });
  };
  const regionStatisticCode = (region: WildfireRegionStatistic) => {
    const options = regionStatisticsLevel === "province"
      ? provinceOptions
      : regionStatisticsLevel === "city"
        ? cityOptions
        : regionStatisticsLevel === "district"
          ? districtOptions
          : villageOptions;
    return region.code || matchRegionOption(options, region.name)?.code;
  };
  const selectRegionStatistic = (region: WildfireRegionStatistic) => {
    const code = regionStatisticCode(region);
    if (!code) return;
    if (regionStatisticsLevel === "province") {
      updateQuery({
        province: region.name, provinceCode: code,
        city: "", cityCode: "", district: "", districtCode: "", village: "", villageCode: "", hotspot: "",
      });
    } else if (regionStatisticsLevel === "city") {
      updateQuery({
        city: region.name, cityCode: code,
        district: "", districtCode: "", village: "", villageCode: "", hotspot: "",
      });
    } else if (regionStatisticsLevel === "district") {
      updateQuery({ district: region.name, districtCode: code, village: "", villageCode: "", hotspot: "" });
    } else {
      updateQuery({ village: region.name, villageCode: code, hotspot: "" });
    }
  };
  if (!event)
    return (
      <div className="wildfire-shell">
        <div className="alert alert-danger">{t("wildfire.errors.notFound")}</div>
        <Link to="/pemetaan-bencana/karhutla">{t("wildfire.backIndex")}</Link>
      </div>
    );
  const activeSummary = summary ?? summaryFromEvent(event);
  const eventApiUnavailable = currentEventLookupStatus === "unavailable" && !eventBackedByApi;
  const regionStatisticsNotice = regionStatisticsError ?? (
    eventApiUnavailable ? t("wildfire.errors.regionStatisticsUnavailable") : null
  );
  const summaryUnavailable = Boolean(
    selectedRegion && (dataError || (loading && summary == null)),
  );
  // When the API has no daily timeline yet, the fallback histogram contains
  // the event total. Include that total in the scale so its inline height
  // stays within 0–100% instead of becoming 697000% for 6,970 hotspots.
  const timelineStart = query.from || event.monitoring_from || event.start_date;
  const timelineEnd =
    query.to ||
    event.monitoring_to ||
    event.end_date ||
    event.last_data_at?.slice(0, 10) ||
    timelineStart;
  const sourceTimeline = timeline.length
    ? timeline
    : !selectedRegion && dataError && event.slug === "kalimantan-2026"
      ? FALLBACK_KALIMANTAN_TIMELINE
      : !selectedRegion && activeSummary.total_hotspots > 0
        ? [{ date: timelineStart, count: activeSummary.total_hotspots }]
        : [];
  const timelineData = completeTimeline(sourceTimeline, timelineStart, timelineEnd);
  const sortedTimelineData = [...timelineData].sort((a, b) => {
    if (timelineSort === "date-desc") return b.date.localeCompare(a.date);
    if (timelineSort === "count-desc") return b.count - a.count || a.date.localeCompare(b.date);
    if (timelineSort === "count-asc") return a.count - b.count || a.date.localeCompare(b.date);
    return a.date.localeCompare(b.date);
  });
  const datasetEnd =
    event.last_data_at?.slice(0, 10) || event.monitoring_to || event.end_date || isoDate(new Date());
  const timelineFromValue = query.from || timelineStart;
  const timelineToValue = query.to || timelineEnd;
  const applyTimelinePreset = (preset: TimelinePreset) => {
    setTimelinePreset(preset);
    if (preset === "all") {
      updateQuery({ from: "", to: "" });
      return;
    }
    if (preset === "today" || preset === "date") {
      updateQuery({ from: datasetEnd, to: datasetEnd });
      return;
    }
    if (preset === "7d") {
      updateQuery({ from: shiftIsoDate(datasetEnd, -6), to: datasetEnd });
      return;
    }
    if (preset === "30d") {
      updateQuery({ from: shiftIsoDate(datasetEnd, -29), to: datasetEnd });
    }
  };
  const timelineTotal = timelineData.reduce((total, point) => total + point.count, 0);
  return (
    <div className="wildfire-shell wildfire-detail-shell">
      <div className="wildfire-detail-topbar">
        <div>
          <Link className="wildfire-back-link" to="/pemetaan-bencana/karhutla">
            <i className="bi bi-arrow-left" /> {t("wildfire.backIndex")}
          </Link>
          <div className="wildfire-title-row">
            <h1>{event.title}</h1>
            <WildfireStatusBadge event={event} />
          </div>
          <p>
            {event.provinces.join(", ")} · {periodLabel(event, language)} · {t("wildfire.updated")}{" "}
            {event.last_data_at ? formatDate(event.last_data_at, language, true) : "—"}
          </p>
        </div>
        <div className="wildfire-detail-actions">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
          >
            <i className="bi bi-share" /> {t("wildfire.actions.share")}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => updateQuery({ panel: "methodology" })}
          >
            <i className="bi bi-journal-text" /> {t("wildfire.actions.methodology")}
          </button>
        </div>
      </div>
      <div className="wildfire-filter-toolbar">
        <label>
          {t("wildfire.filters.from")}
          <input
            type="date"
            value={query.from || event.monitoring_from}
            onChange={(e) => updateQuery({ from: e.target.value })}
          />
        </label>
        <label>
          {t("wildfire.filters.to")}
          <input
            type="date"
            value={query.to || event.last_data_at?.slice(0, 10) || ""}
            onChange={(e) => updateQuery({ to: e.target.value })}
          />
        </label>
        <label>
          {t("wildfire.filters.sensor")}
          <select value={query.sensor} onChange={(e) => updateQuery({ sensor: e.target.value })}>
            <option value="all">{t("wildfire.filters.allSensors")}</option>
            <option value="viirs">VIIRS</option>
            <option value="modis">MODIS</option>
            <option value="landsat">Landsat</option>
          </select>
        </label>
        <div className="wildfire-confidence-filter">
          <span>{t("wildfire.filters.confidence")}</span>
          {(["high", "nominal", "low"] as const).map((confidence) => (
            <label key={confidence} className="wildfire-check">
              <input
                type="checkbox"
                checked={query.confidence.includes(confidence)}
                onChange={(e) =>
                  updateQuery({
                    confidence: e.target.checked
                      ? [...query.confidence, confidence]
                      : query.confidence.filter((item) => item !== confidence),
                  })
                }
              />
              {confidence === "high"
                ? t("wildfire.confidence.high")
                : confidence === "nominal"
                  ? t("wildfire.confidence.nominal")
                  : t("wildfire.confidence.low")}
            </label>
          ))}
        </div>
      </div>
      {event.province_codes.length > 0 && (
        <section className="wildfire-region-workspace" aria-label="Filter wilayah">
          <div className="wildfire-region-filter-panel">
            <div className="wildfire-region-panel-heading">
              <details className="wildfire-region-filter-accordion">
                <summary>
                  <h2><i className="bi bi-geo-alt" aria-hidden="true" /> Filter wilayah</h2>
                  <span>Pilih batas administrasi untuk menyaring peta dan statistik hotspot.</span>
                  <i className="bi bi-chevron-down wildfire-region-filter-chevron" aria-hidden="true" />
                </summary>
                <div className="wildfire-region-filter-grid">
                  <label>
                    Provinsi
                    <select
                      value={query.provinceCode || provinceOptions.find((option) => option.name === query.province)?.code || ""}
                      disabled={regionOptionsLoading}
                      onChange={(event) => {
                        const option = provinceOptions.find((item) => item.code === event.target.value);
                        updateQuery({
                          province: option?.name ?? "", provinceCode: option?.code ?? "",
                          city: "", cityCode: "", district: "", districtCode: "", village: "", villageCode: "", hotspot: "",
                        });
                      }}
                    >
                      <option value="">Semua provinsi Kalimantan</option>
                      {provinceOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Kabupaten/kota
                    <select
                      value={query.cityCode}
                      disabled={!query.provinceCode || cityOptionsLoading}
                      onChange={(event) => {
                        const option = cityOptions.find((item) => item.code === event.target.value);
                        updateQuery({
                          city: option?.name ?? "", cityCode: option?.code ?? "",
                          district: "", districtCode: "", village: "", villageCode: "", hotspot: "",
                        });
                      }}
                    >
                      <option value="">{cityOptionsLoading ? "Memuat kabupaten/kota…" : "Semua kabupaten/kota"}</option>
                      {cityOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Kecamatan
                    <select
                      value={query.districtCode}
                      disabled={!query.cityCode || districtOptionsLoading}
                      onChange={(event) => {
                        const option = districtOptions.find((item) => item.code === event.target.value);
                        updateQuery({ district: option?.name ?? "", districtCode: option?.code ?? "", village: "", villageCode: "", hotspot: "" });
                      }}
                    >
                      <option value="">{districtOptionsLoading ? "Memuat kecamatan…" : "Semua kecamatan"}</option>
                      {districtOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Kelurahan/desa
                    <select
                      value={query.villageCode}
                      disabled={!query.districtCode || villageOptionsLoading}
                      onChange={(event) => {
                        const option = villageOptions.find((item) => item.code === event.target.value);
                        updateQuery({ village: option?.name ?? "", villageCode: option?.code ?? "", hotspot: "" });
                      }}
                    >
                      <option value="">{villageOptionsLoading ? "Memuat kelurahan/desa…" : "Semua kelurahan/desa"}</option>
                      {villageOptions.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
                    </select>
                  </label>
                </div>
                {regionOptionsError && <div className="wildfire-region-error" role="status">{regionOptionsError}</div>}
              </details>
              <button
                type="button"
                className="wildfire-region-reset"
                onClick={() => updateQuery({
                  province: "", provinceCode: "", city: "", cityCode: "",
                  district: "", districtCode: "", village: "", villageCode: "", hotspot: "",
                })}
                disabled={!selectedRegion && !query.province && !query.city && !query.district && !query.village}
              >
                Hapus filter
              </button>
            </div>
          </div>
        </section>
      )}
      {loading && (
        <div className="wildfire-filter-loading" role="status" aria-live="polite">
          <span className="wildfire-loading-spinner" aria-hidden="true" />
          {t("wildfire.timeline.loading")}
        </div>
      )}
      <div className="wildfire-detail-layout">
        <main className="wildfire-map-first">
          <div className="wildfire-map-status">
            <span>
              {loading
                ? t("wildfire.loading")
                : summaryUnavailable
                  ? `— ${t("wildfire.stats.hotspots")}`
                  : `${formatNumber(activeSummary.total_hotspots, language)} ${t("wildfire.stats.hotspots")}`}
            </span>
            <span>
              {!summaryUnavailable && activeSummary.latest_acquisition_time
                ? `${t("wildfire.latestAcquisition")}: ${formatDate(activeSummary.latest_acquisition_time, language, true)}`
                : ""}
            </span>
          </div>
          {dataError && (
            <div className="wildfire-data-error" role="alert">
              <i className="bi bi-exclamation-triangle" aria-hidden="true" />
              <span>{dataError}</span>
            </div>
          )}
          {mapNotice && (
            <div className="wildfire-map-hint">
              <i className="bi bi-info-circle" aria-hidden="true" /> {mapNotice}
            </div>
          )}
          <HotspotMap
            event={event}
            features={features}
            query={query}
            onSelect={(feature) => {
              const index = features.indexOf(feature);
              updateQuery({ hotspot: String(index) });
            }}
            onToggleLayer={(layer) =>
              updateQuery({
                layers: query.layers.includes(layer)
                  ? query.layers.filter((item) => item !== layer)
                  : [...query.layers, layer],
              })
            }
            onSync={syncData}
            syncing={syncing}
            syncError={syncError}
            dataRevision={dataRevision}
          />
          <div className={`wildfire-timeline-panel${loading ? " is-loading" : ""}`} aria-busy={loading}>
            <div className="wildfire-panel-heading">
              <div>
                <h2>{t("wildfire.timeline.title")}</h2>
                <span className="wildfire-timeline-subtitle">{t("wildfire.timeline.alt")}</span>
              </div>
              <div className="wildfire-timeline-total">
                <strong>{formatNumber(timelineTotal, language)}</strong>
                <span>{t("wildfire.stats.hotspots")}</span>
              </div>
            </div>
            <div className="wildfire-timeline-controls" aria-label={t("wildfire.timeline.filters")}>
              <label>
                {t("wildfire.timeline.period")}
                <select
                  value={timelinePreset}
                  onChange={(event) => applyTimelinePreset(event.target.value as TimelinePreset)}
                >
                  <option value="all">{t("wildfire.timeline.periodAll")}</option>
                  <option value="today">{t("wildfire.timeline.periodToday")}</option>
                  <option value="7d">{t("wildfire.timeline.period7d")}</option>
                  <option value="30d">{t("wildfire.timeline.period30d")}</option>
                  <option value="date">{t("wildfire.timeline.periodDate")}</option>
                  <option value="range">{t("wildfire.timeline.periodRange")}</option>
                </select>
              </label>
              {timelinePreset === "date" && (
                <label>
                  {t("wildfire.timeline.date")}
                  <input
                    type="date"
                    value={query.from || datasetEnd}
                    onChange={(event) => {
                      setTimelinePreset("date");
                      updateQuery({ from: event.target.value, to: event.target.value });
                    }}
                  />
                </label>
              )}
              {timelinePreset === "range" && (
                <>
                  <label>
                    {t("wildfire.filters.from")}
                    <input
                      type="date"
                      value={timelineFromValue}
                      onChange={(event) => updateQuery({ from: event.target.value })}
                    />
                  </label>
                  <label>
                    {t("wildfire.filters.to")}
                    <input
                      type="date"
                      value={timelineToValue}
                      onChange={(event) => updateQuery({ to: event.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                {t("wildfire.timeline.sort")}
                <select
                  value={timelineSort}
                  onChange={(event) => setTimelineSort(event.target.value as WildfireTimelineSort)}
                >
                  <option value="date-asc">{t("wildfire.timeline.sortDateAsc")}</option>
                  <option value="date-desc">{t("wildfire.timeline.sortDateDesc")}</option>
                  <option value="count-desc">{t("wildfire.timeline.sortCountDesc")}</option>
                  <option value="count-asc">{t("wildfire.timeline.sortCountAsc")}</option>
                </select>
              </label>
              <label>
                {t("wildfire.timeline.chart")}
                <select
                  value={timelineChart}
                  onChange={(event) => setTimelineChart(event.target.value as WildfireTimelineChart)}
                >
                  <option value="bar">{t("wildfire.timeline.chartBar")}</option>
                  <option value="line">{t("wildfire.timeline.chartLine")}</option>
                  <option value="area">{t("wildfire.timeline.chartArea")}</option>
                </select>
              </label>
            </div>
            <div className="wildfire-timeline-summary">
              <span>
                <i className="bi bi-calendar3" aria-hidden="true" /> {formatDate(timelineStart, language)} – {formatDate(timelineEnd, language)}
              </span>
              <span>
                {formatNumber(timelineData.length, language)} {t("wildfire.timeline.days")}
              </span>
            </div>
            <div
              className="wildfire-timeline-chart"
              role="group"
              aria-label={t("wildfire.timeline.alt")}
            >
              <TimelineChart
                data={sortedTimelineData}
                chartType={timelineChart}
                sort={timelineSort}
                language={language}
              />
            </div>
            {loading && (
              <div className="wildfire-timeline-loading-overlay" aria-hidden="true">
                <span className="wildfire-loading-spinner" />
              </div>
            )}
          </div>
          {event.province_codes.length > 0 && (
            <div className="wildfire-region-statistics">
              <div className="wildfire-region-panel-heading">
                <div>
                  <h2>Jumlah hotspot per {({ province: "provinsi", city: "kabupaten/kota", district: "kecamatan", village: "kelurahan/desa" } as const)[regionStatisticsLevel]}</h2>
                  <span>
                    {query.district || query.city || query.province || "Seluruh Kalimantan"} · mengikuti periode, sensor, dan tingkat keyakinan terpilih
                  </span>
                </div>
                {regionStatisticsLoading && <span className="wildfire-region-loading" role="status">Menghitung…</span>}
              </div>
              {regionStatisticsNotice ? (
                <div className="wildfire-region-error" role="alert">{regionStatisticsNotice}</div>
              ) : (
                <div className="wildfire-region-table-wrap">
                  <table className="wildfire-region-table">
                    <thead><tr><th>Wilayah</th><th>Jumlah hotspot</th><th>Keyakinan tinggi</th></tr></thead>
                    <tbody>
                      {regionStatisticsLoading && regionStatistics.length === 0 ? (
                        <tr><td colSpan={3}>Memuat statistik batas wilayah…</td></tr>
                      ) : regionStatistics.length === 0 ? (
                        <tr><td colSpan={3}>Belum ada data hotspot pada wilayah dan filter ini.</td></tr>
                      ) : regionStatistics.map((region, index) => (
                        <tr key={`${region.code}:${region.name}:${index}`}>
                          <td>
                            <button type="button" className="wildfire-region-stat-link" onClick={() => selectRegionStatistic(region)} disabled={!regionStatisticCode(region)}>
                              {region.name}<i className="bi bi-arrow-down-right" aria-hidden="true" />
                            </button>
                          </td>
                          <td>{formatNumber(region.hotspot_count, language)}</td>
                          <td>{formatNumber(region.high_confidence_count, language)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <small className="wildfire-region-attribution">Sumber hotspot NASA FIRMS; batas administratif SP3STAB. Hotspot adalah deteksi anomali panas, bukan luas area terbakar.</small>
            </div>
          )}
        </main>
        <aside className="wildfire-detail-sidebar">
          <div className="wildfire-stat-grid">
            <Stat
              label={t("wildfire.stats.hotspots")}
              value={summaryUnavailable ? "—" : formatNumber(activeSummary.total_hotspots, language)}
              tone="orange"
              icon="bi-fire"
              loading={loading && summary == null}
            />
            <Stat
              label={t("wildfire.stats.highConfidence")}
              value={summaryUnavailable ? "—" : formatNumber(activeSummary.high_confidence_hotspots, language)}
              tone="red"
              icon="bi-shield-check"
              loading={loading && summary == null}
            />
            <Stat
              label={t("wildfire.stats.regions")}
              value={summaryUnavailable ? "—" : formatNumber(activeSummary.affected_regions, language)}
              tone="teal"
              icon="bi-geo-alt"
              loading={loading && summary == null}
            />
            <Stat
              label={t("wildfire.stats.burnedArea")}
              value={
                summaryUnavailable || activeSummary.burned_area_ha == null
                  ? "—"
                  : `${formatNumber(activeSummary.burned_area_ha, language)} ha`
              }
              tone="purple"
              icon="bi-rulers"
              loading={loading && summary == null}
            />
          </div>
          <section className="wildfire-side-card">
            <h2>{t("wildfire.analysis.title")}</h2>
            {summaryUnavailable ? (
              <p>Ringkasan tingkat keyakinan tidak tersedia untuk wilayah terpilih.</p>
            ) : (
              <div className="wildfire-confidence-bars">
                <Bar
                  label={t("wildfire.confidence.high")}
                  count={activeSummary.high_confidence_hotspots}
                  total={activeSummary.total_hotspots}
                  color="high"
                />
                <Bar
                  label={t("wildfire.confidence.nominal")}
                  count={activeSummary.nominal_confidence_hotspots}
                  total={activeSummary.total_hotspots}
                  color="nominal"
                />
                <Bar
                  label={t("wildfire.confidence.low")}
                  count={activeSummary.low_confidence_hotspots}
                  total={activeSummary.total_hotspots}
                  color="low"
                />
              </div>
            )}
          </section>
          <section className="wildfire-side-card">
            <h2>{t("wildfire.sources.title")}</h2>
            <p>{event.source}</p>
            <p className="wildfire-muted">
              {event.burned_area_ha == null
                ? t("wildfire.sources.noBurnedArea")
                : `${t("wildfire.sources.burnedAreaNote")}: ${event.burned_area_source}`}
            </p>
            <small>{event.methodology}</small>
          </section>
          {query.panel === "methodology" && (
            <section className="wildfire-side-card">
              <h2>{t("wildfire.methodology.title")}</h2>
              <p>{event.methodology}</p>
              <ul>
                {event.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  icon,
  loading = false,
}: {
  label: string;
  value: string;
  tone: string;
  icon: string;
  loading?: boolean;
}) {
  return (
    <div
      className={`wildfire-stat wildfire-stat-${tone}${loading ? " is-loading" : ""}`}
      aria-busy={loading}
    >
      <div className="wildfire-stat-label">
        <span className="wildfire-stat-icon" aria-hidden="true">
          <i className={`bi ${icon}`} />
        </span>
        <span>{label}</span>
      </div>
      {loading ? (
        <span className="wildfire-stat-value-skeleton" aria-label={label} role="status" />
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}
function Bar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  return (
    <div className="wildfire-bar-row">
      <div>
        <span>{label}</span>
        <strong>{count.toLocaleString("id-ID")}</strong>
      </div>
      <div className="wildfire-bar-track">
        <i
          className={`wildfire-bar-${color}`}
          style={{ width: `${total ? Math.min(100, (count / total) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}
export function adaptLegacyEvent(event: Partial<WildfireEvent> | DisasterEventListItem) {
  const raw = event as Omit<Partial<WildfireEvent>, "status"> & {
    name?: string | null;
    province?: string[];
    event_date?: string | null;
    status?: string;
    description?: string | null;
  };
  const slug = String(raw.slug ?? raw.name ?? "wildfire-event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    ...FALLBACK_WILDFIRE_EVENTS[0],
    ...raw,
    id: raw.id ?? slug,
    slug,
    title: raw.title ?? raw.name ?? slug,
    short_title: raw.short_title ?? raw.name ?? slug,
    disaster_type: "forest_fire",
    status: raw.status === "published" ? "active" : (raw.status ?? "monitoring"),
    start_date: raw.start_date ?? raw.event_date ?? FALLBACK_WILDFIRE_EVENTS[0].start_date,
    monitoring_from:
      raw.monitoring_from ?? raw.start_date ?? FALLBACK_WILDFIRE_EVENTS[0].monitoring_from,
    provinces: raw.provinces ?? raw.province ?? [],
    province_codes: raw.province_codes ?? [],
    city_codes: raw.city_codes ?? [],
    bbox: raw.bbox ?? FALLBACK_WILDFIRE_EVENTS[0].bbox,
    center_lat: raw.center_lat ?? FALLBACK_WILDFIRE_EVENTS[0].center_lat,
    center_lon: raw.center_lon ?? FALLBACK_WILDFIRE_EVENTS[0].center_lon,
    default_zoom: raw.default_zoom ?? 5,
    source: raw.source ?? "NASA FIRMS",
    hotspot_count: raw.hotspot_count ?? 0,
    high_confidence_count: raw.high_confidence_count ?? 0,
    burned_area_ha: raw.burned_area_ha ?? null,
    burned_area_source: raw.burned_area_source ?? null,
    updated_at: raw.updated_at ?? null,
    limitations: raw.limitations ?? [],
    source_ids: raw.source_ids ?? ["nasa-firms"],
  } as WildfireEvent;
}

export function useWildfireEventsFallback() {
  return FALLBACK_WILDFIRE_EVENTS;
}
