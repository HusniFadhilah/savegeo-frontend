import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import { useI18nStore } from "@/hooks/useI18nStore";
import { formatDate, formatNumber, localeFor } from "@/hooks/useI18nStore";
import { ApiError, apiClient } from "@/services/apiClient";
import { fetchProvinces } from "@/services/analysisService";
import { fetchWildfireEvent, fetchWildfireEvents, fetchWildfireHotspots, fetchWildfireSummary, fetchWildfireTimeline } from "@/features/disaster/api";
import { FALLBACK_WILDFIRE_EVENTS } from "./data";
import { parseWildfireQuery, writeWildfireQuery, type WildfireQueryState } from "./queryState";
import type { WildfireEvent, WildfireFilters, WildfireSummary, WildfireTimelinePoint } from "./types";
import type { FirmsHotspotFeature } from "@/features/disaster/types";
import type { DisasterEventListItem } from "@/features/disaster/types";

function statusLabel(status: WildfireEvent["status"], language: "id" | "en") {
  const labels = language === "id"
    ? { active: "Aktif", monitoring: "Dalam pemantauan", completed: "Selesai", archived: "Diarsipkan" }
    : { active: "Active", monitoring: "Monitoring", completed: "Completed", archived: "Archived" };
  return labels[status];
}

function LanguageToggle() {
  const { language, setLanguage } = useI18nStore();
  return <button type="button" className="wildfire-language-toggle" aria-label="Switch language" onClick={() => setLanguage(language === "id" ? "en" : "id")}>{language.toUpperCase()}</button>;
}

function periodLabel(event: WildfireEvent, language: "id" | "en") {
  const start = new Intl.DateTimeFormat(localeFor(language), { month: "short", year: "numeric" }).format(new Date(event.start_date));
  return `${start} – ${event.end_date ? new Intl.DateTimeFormat(localeFor(language), { month: "short", year: "numeric" }).format(new Date(event.end_date)) : language === "id" ? "sekarang" : "present"}`;
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
  return <span className={`wildfire-status wildfire-status-${event.status}`}><span aria-hidden="true" />{statusLabel(event.status, language)}</span>;
}

export function KarhutlaOverviewCard({ event }: { event: WildfireEvent }) {
  const { t, language } = useI18nStore();
  return (
    <section className="wildfire-overview-card" aria-labelledby="wildfire-overview-title">
      <div className="wildfire-overview-visual" role="img" aria-label={t("wildfire.overview.mapAlt")}>
        <div className="wildfire-preview-grid" />
        <i className="bi bi-fire" aria-hidden="true" />
        <span>{event.provinces.length} {t("wildfire.overview.provinces")}</span>
      </div>
      <div className="wildfire-overview-content">
        <div className="wildfire-eyebrow">{t("wildfire.category")}</div>
        <div className="wildfire-title-row"><h2 id="wildfire-overview-title">{event.title}</h2><WildfireStatusBadge event={event} /></div>
        <p className="wildfire-muted">{event.description}</p>
        <div className="wildfire-overview-metrics">
          <div><strong>{formatNumber(event.hotspot_count, language)}</strong><span>{t("wildfire.stats.hotspots")}</span></div>
          <div><strong>{formatNumber(event.high_confidence_count, language)}</strong><span>{t("wildfire.stats.highConfidence")}</span></div>
          <div><strong>{event.burned_area_ha == null ? "—" : `${formatNumber(event.burned_area_ha, language, { maximumFractionDigits: 0 })} ha`}</strong><span>{t("wildfire.stats.burnedArea")}</span></div>
        </div>
        <div className="wildfire-card-meta"><span><i className="bi bi-calendar3" /> {periodLabel(event, language)}</span><span><i className="bi bi-clock" /> {event.last_data_at ? formatDate(event.last_data_at, language, true) : "—"}</span></div>
        <div className="wildfire-card-actions"><Link className="btn btn-primary" to={`/pemetaan-bencana/karhutla/${event.slug}`}>{t("wildfire.overview.more")}</Link><Link className="wildfire-secondary-link" to="/pemetaan-bencana/karhutla">{t("wildfire.overview.allEvents")} <i className="bi bi-arrow-up-right" /></Link></div>
      </div>
    </section>
  );
}

function EventSummaryMap({ events }: { events: WildfireEvent[] }) {
  const navigate = useNavigate();
  return <div className="wildfire-summary-map" aria-label="Peta ringkasan kejadian karhutla">
    <MapContainer center={[-1.7, 113.4]} zoom={4} scrollWheelZoom={false} zoomControl={false} dragging={false} doubleClickZoom={false} className="savegeo-map">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
      {events.map((event) => <CircleMarker key={event.slug} center={[event.center_lat, event.center_lon]} radius={Math.max(7, Math.min(16, event.hotspot_count / 700))} pathOptions={{ color: "#ff6b35", fillColor: "#ff9f1c", fillOpacity: 0.75, weight: 2 }} eventHandlers={{ click: () => navigate(`/pemetaan-bencana/karhutla/${event.slug}`) }}><Popup><strong>{event.title}</strong><br />{event.hotspot_count.toLocaleString("id-ID")} hotspots</Popup></CircleMarker>)}
    </MapContainer>
  </div>;
}

export function KarhutlaIndexPage() {
  const { t, language } = useI18nStore();
  const [events, setEvents] = useState<WildfireEvent[]>(FALLBACK_WILDFIRE_EVENTS);
  const [filters, setFilters] = useState<WildfireFilters>({ search: "", year: "", status: "", province: "", severity: "", sort: "latest" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWildfireEvents(filters).then((response) => {
      if (!cancelled && response.events.length) setEvents(response.events.map(adaptLegacyEvent));
    }).catch((err) => {
      if (!cancelled) setError(err instanceof ApiError ? err.message : t("wildfire.errors.load"));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.search, filters.year, filters.status, filters.province, filters.severity, filters.sort]);

  const filtered = useMemo(() => events.filter((event) => {
    const haystack = `${event.title} ${event.provinces.join(" ")}`.toLowerCase();
    return (!filters.search || haystack.includes(filters.search.toLowerCase())) && (!filters.year || String(event.year) === filters.year) && (!filters.status || event.status === filters.status) && (!filters.province || event.provinces.includes(filters.province)) && (!filters.severity || event.severity === filters.severity);
  }).sort((a, b) => filters.sort === "hotspots" ? b.hotspot_count - a.hotspot_count : filters.sort === "region" ? a.provinces[0].localeCompare(b.provinces[0]) : String(b.updated_at).localeCompare(String(a.updated_at))), [events, filters]);
  const provinceOptions = [...new Set(events.flatMap((event) => event.provinces))].sort();

  return <div className="wildfire-shell">
    <div className="wildfire-page-header"><div><Link className="wildfire-back-link" to="/pemetaan-bencana"><i className="bi bi-arrow-left" /> {t("wildfire.backOverview")}</Link><div className="wildfire-eyebrow">{t("wildfire.category")}</div><h1>{t("wildfire.index.title")}</h1><p>{t("wildfire.index.description")}</p></div><div className="wildfire-header-tools"><LanguageToggle /><div className="wildfire-last-sync"><i className="bi bi-arrow-repeat" /> {t("wildfire.updated")} {formatDate(events[0]?.updated_at ?? new Date(), language, true)}</div></div></div>
    <div className="wildfire-index-layout"><EventSummaryMap events={filtered} /><aside className="wildfire-event-list-panel"><div className="wildfire-panel-heading"><h2>{t("wildfire.index.events")}</h2><span>{filtered.length}</span></div><div className="wildfire-filter-row"><label className="visually-hidden" htmlFor="wildfire-search">{t("wildfire.filters.search")}</label><div className="wildfire-search"><i className="bi bi-search" /><input id="wildfire-search" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder={t("wildfire.filters.searchPlaceholder")} /></div><select aria-label={t("wildfire.filters.status")} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="">{t("wildfire.filters.allStatus")}</option><option value="active">{statusLabel("active", language)}</option><option value="monitoring">{statusLabel("monitoring", language)}</option><option value="completed">{statusLabel("completed", language)}</option><option value="archived">{statusLabel("archived", language)}</option></select></div><div className="wildfire-filter-row"><select aria-label={t("wildfire.filters.year")} value={filters.year} onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}><option value="">{t("wildfire.filters.allYears")}</option>{[...new Set(events.map((e) => e.year))].sort((a, b) => b - a).map((year) => <option key={year}>{year}</option>)}</select><select aria-label={t("wildfire.filters.province")} value={filters.province} onChange={(e) => setFilters((f) => ({ ...f, province: e.target.value }))}><option value="">{t("wildfire.filters.allProvinces")}</option>{provinceOptions.map((province) => <option key={province}>{province}</option>)}</select><select aria-label={t("wildfire.filters.sort")} value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as WildfireFilters["sort"] }))}><option value="latest">{t("wildfire.filters.latest")}</option><option value="hotspots">{t("wildfire.filters.mostHotspots")}</option><option value="region">{t("wildfire.filters.region")}</option></select></div>{loading && <div className="wildfire-inline-status" role="status"><span className="spinner-border spinner-border-sm" /> {t("wildfire.loading")}</div>}{error && <div className="alert alert-warning py-2">{error}</div>}{!loading && !filtered.length && <div className="wildfire-empty"><i className="bi bi-binoculars" /><strong>{t("wildfire.empty.title")}</strong><span>{t("wildfire.empty.description")}</span></div>}<div className="wildfire-event-cards">{filtered.map((event) => <article className="wildfire-event-row" key={event.slug}><div className="wildfire-event-row-icon"><i className="bi bi-fire" /></div><div className="wildfire-event-row-copy"><div className="wildfire-title-row"><h3>{event.title}</h3><WildfireStatusBadge event={event} /></div><p>{event.provinces.join(", ")} · {periodLabel(event, language)}</p><div className="wildfire-row-stats"><span><strong>{formatNumber(event.hotspot_count, language)}</strong> {t("wildfire.stats.hotspots")}</span><span><strong>{formatNumber(event.high_confidence_count, language)}</strong> {t("wildfire.stats.highConfidence")}</span></div><Link className="wildfire-row-link" to={`/pemetaan-bencana/karhutla/${event.slug}`}>{t("wildfire.index.openDetail")} <i className="bi bi-arrow-right" /></Link></div></article>)}</div></aside></div>
  </div>;
}

function HotspotMap({ event, features, query, onSelect }: { event: WildfireEvent; features: FirmsHotspotFeature[]; query: WildfireQueryState; onSelect: (feature: FirmsHotspotFeature) => void }) {
  const [boundary, setBoundary] = useState<GeoJSON.GeoJSON | null>(null);
  const [boundaryFailed, setBoundaryFailed] = useState(false);
  useEffect(() => {
    if (!query.province) return;
    fetchProvinces().then((provinces) => { const match = provinces.find((item) => item.name === query.province); if (match) return fetchRegionGeometry(match.code).then(setBoundary); throw new Error("missing"); }).catch(() => setBoundaryFailed(true));
  }, [query.province]);
  return <div className="wildfire-map-wrap"><MapView id="wildfire-detail-map" center={query.lat != null && query.lng != null ? [query.lat, query.lng] : [event.center_lat, event.center_lon]} zoom={query.zoom ?? event.default_zoom} showGlobeControl={false}><BasemapSwitcher />{boundary && query.layers.includes("boundary") && <GeoJSON data={boundary as GeoJSON.GeoJsonObject} style={{ color: "#43d9b2", weight: 2, fillOpacity: 0.05 }} />}{features.map((feature, index) => { const [lng, lat] = feature.geometry.coordinates; const selected = query.hotspot === String(index); return <CircleMarker key={`${feature.properties.source}-${feature.properties.acq_datetime_utc}-${index}`} center={[lat, lng]} radius={selected ? 9 : 5} pathOptions={{ color: feature.properties.confidence_label === "high" ? "#ff4d6d" : "#ffd166", fillColor: feature.properties.confidence_label === "high" ? "#ff4d6d" : "#ffd166", fillOpacity: 0.9, weight: selected ? 3 : 1 }} eventHandlers={{ click: () => onSelect(feature) }}><Popup closeButton><div className="wildfire-popup"><strong>{feature.properties.confidence_label === "high" ? "High confidence" : "Hotspot"}</strong><dl><dt>Acquisition</dt><dd>{feature.properties.acq_datetime_utc ?? feature.properties.acq_date}</dd>{feature.properties.satellite && <><dt>Satellite</dt><dd>{feature.properties.satellite}</dd></>}{feature.properties.instrument && <><dt>Sensor</dt><dd>{feature.properties.instrument}</dd></>}<dt>Coordinates</dt><dd>{lat.toFixed(5)}, {lng.toFixed(5)}</dd>{feature.properties.frp != null && <><dt>FRP</dt><dd>{feature.properties.frp} MW</dd></>}</dl></div></Popup></CircleMarker>; })}</MapView>{boundaryFailed && <div className="wildfire-map-notice" role="status"><i className="bi bi-info-circle" /> Batas wilayah sementara tidak tersedia. Hotspot tetap ditampilkan.</div>}<div className="wildfire-map-legend"><span><i className="legend-dot legend-high" /> {"High confidence"}</span><span><i className="legend-dot legend-nominal" /> {"Nominal / low"}</span></div></div>;
}

async function fetchRegionGeometry(code: string) {
  return apiClient.get<GeoJSON.GeoJSON>(`/regions/provinces/${encodeURIComponent(code)}/geometry`);
}

export function KarhutlaDetailPage() {
  const { t, language } = useI18nStore();
  const { eventSlug = "kalimantan-2026" } = useParams<{ eventSlug?: string }>();
  const slug = eventSlug;
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<WildfireEvent | null>(FALLBACK_WILDFIRE_EVENTS.find((item) => item.slug === slug) ?? null);
  const [summary, setSummary] = useState<WildfireSummary | null>(null);
  const [features, setFeatures] = useState<FirmsHotspotFeature[]>([]);
  const [timeline, setTimeline] = useState<WildfireTimelinePoint[]>([]);
  const [query, setQuery] = useState(() => parseWildfireQuery(searchParams.toString()));
  const [loading, setLoading] = useState(true);
  const [boundaryDrawerOpen, setBoundaryDrawerOpen] = useState(false);

  useEffect(() => { fetchWildfireEvent(slug).then((response) => setEvent(adaptLegacyEvent(response.event))).catch(() => undefined); }, [slug]);
  useEffect(() => { if (!event) return; const from = query.from || event.monitoring_from; const to = query.to || event.last_data_at?.slice(0, 10) || new Date().toISOString().slice(0, 10); let cancelled = false; setLoading(true); Promise.all([fetchWildfireSummary(event.slug, { from, to, confidence: query.confidence.join(",") }).catch(() => summaryFromEvent(event)), fetchWildfireHotspots(event.slug, { from, to, sensor: query.sensor === "all" ? undefined : query.sensor, confidence: query.confidence.join(",") }).catch(() => null), fetchWildfireTimeline(event.slug, { from, to }).catch(() => ({ timeline: [] }))]).then(([nextSummary, hotspotResponse, timelineResponse]) => { if (cancelled) return; setSummary(nextSummary); setFeatures(hotspotResponse?.features ?? []); setTimeline(timelineResponse.timeline); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [event, query.from, query.to, query.sensor, query.confidence.join(",")]);
  const updateQuery = (next: Partial<WildfireQueryState>) => { const merged = { ...query, ...next }; setQuery(merged); setSearchParams(writeWildfireQuery(searchParams, merged), { replace: true }); };
  if (!event) return <div className="wildfire-shell"><div className="alert alert-danger">{t("wildfire.errors.notFound")}</div><Link to="/pemetaan-bencana/karhutla">{t("wildfire.backIndex")}</Link></div>;
  const activeSummary = summary ?? summaryFromEvent(event);
  const maxTimeline = Math.max(1, ...timeline.map((point) => point.count));
  return <div className="wildfire-shell wildfire-detail-shell"><div className="wildfire-detail-topbar"><div><Link className="wildfire-back-link" to="/pemetaan-bencana/karhutla"><i className="bi bi-arrow-left" /> {t("wildfire.backIndex")}</Link><div className="wildfire-title-row"><h1>{event.title}</h1><WildfireStatusBadge event={event} /></div><p>{event.provinces.join(", ")} · {periodLabel(event, language)} · {t("wildfire.updated")} {event.last_data_at ? formatDate(event.last_data_at, language, true) : "—"}</p></div><div className="wildfire-detail-actions"><button type="button" className="btn btn-outline-secondary" onClick={() => navigator.clipboard?.writeText(window.location.href)}><i className="bi bi-share" /> {t("wildfire.actions.share")}</button><button type="button" className="btn btn-outline-secondary" onClick={() => updateQuery({ panel: "methodology" })}><i className="bi bi-journal-text" /> {t("wildfire.actions.methodology")}</button></div></div><div className="wildfire-filter-toolbar"><label>{t("wildfire.filters.from")}<input type="date" value={query.from || event.monitoring_from} onChange={(e) => updateQuery({ from: e.target.value })} /></label><label>{t("wildfire.filters.to")}<input type="date" value={query.to || event.last_data_at?.slice(0, 10) || ""} onChange={(e) => updateQuery({ to: e.target.value })} /></label><label>{t("wildfire.filters.sensor")}<select value={query.sensor} onChange={(e) => updateQuery({ sensor: e.target.value })}><option value="all">{t("wildfire.filters.allSensors")}</option><option value="viirs">VIIRS</option><option value="modis">MODIS</option><option value="landsat">Landsat</option></select></label><div className="wildfire-confidence-filter"><span>{t("wildfire.filters.confidence")}</span>{(["high", "nominal", "low"] as const).map((confidence) => <label key={confidence} className="wildfire-check"><input type="checkbox" checked={query.confidence.includes(confidence)} onChange={(e) => updateQuery({ confidence: e.target.checked ? [...query.confidence, confidence] : query.confidence.filter((item) => item !== confidence) })} />{confidence === "high" ? t("wildfire.confidence.high") : confidence === "nominal" ? t("wildfire.confidence.nominal") : t("wildfire.confidence.low")}</label>)}</div><button type="button" className="btn btn-sm btn-outline-primary wildfire-mobile-filter" onClick={() => setBoundaryDrawerOpen((open) => !open)}><i className="bi bi-sliders" /> {t("wildfire.actions.filters")}</button></div>{boundaryDrawerOpen && <div className="wildfire-advanced-drawer"><label>{t("wildfire.filters.province")}<input value={query.province} onChange={(e) => updateQuery({ province: e.target.value, city: "" })} placeholder={t("wildfire.filters.provincePlaceholder")} /></label><label>{t("wildfire.filters.city")}<input value={query.city} onChange={(e) => updateQuery({ city: e.target.value })} placeholder={t("wildfire.filters.cityPlaceholder")} /></label></div>}<div className="wildfire-detail-layout"><main className="wildfire-map-first"><div className="wildfire-map-status"><span>{loading ? t("wildfire.loading") : `${formatNumber(features.length || activeSummary.total_hotspots, language)} ${t("wildfire.stats.hotspots")}`}</span><span>{activeSummary.latest_acquisition_time ? `${t("wildfire.latestAcquisition")}: ${formatDate(activeSummary.latest_acquisition_time, language, true)}` : ""}</span></div><HotspotMap event={event} features={features} query={query} onSelect={(feature) => { const index = features.indexOf(feature); updateQuery({ hotspot: String(index) }); }} /><div className="wildfire-timeline-panel"><div className="wildfire-panel-heading"><h2>{t("wildfire.timeline.title")}</h2><span>UTC</span></div><div className="wildfire-histogram" role="img" aria-label={t("wildfire.timeline.alt")}>{(timeline.length ? timeline : [{ date: event.monitoring_from, count: activeSummary.total_hotspots }]).map((point) => <button type="button" key={point.date} title={`${point.date}: ${point.count}`} style={{ height: `${Math.max(8, point.count / maxTimeline * 100)}%` }} aria-label={`${point.date}: ${point.count}`} />)}</div><div className="wildfire-timeline-axis"><span>{query.from || event.monitoring_from}</span><span>{query.to || event.last_data_at?.slice(0, 10)}</span></div></div></main><aside className="wildfire-detail-sidebar"><div className="wildfire-stat-grid"><Stat label={t("wildfire.stats.hotspots")} value={formatNumber(activeSummary.total_hotspots, language)} tone="orange" /><Stat label={t("wildfire.stats.highConfidence")} value={formatNumber(activeSummary.high_confidence_hotspots, language)} tone="red" /><Stat label={t("wildfire.stats.regions")} value={formatNumber(activeSummary.affected_regions, language)} tone="teal" /><Stat label={t("wildfire.stats.burnedArea")} value={activeSummary.burned_area_ha == null ? "—" : `${formatNumber(activeSummary.burned_area_ha, language)} ha`} tone="purple" /></div><section className="wildfire-side-card"><h2>{t("wildfire.analysis.title")}</h2><div className="wildfire-confidence-bars"><Bar label={t("wildfire.confidence.high")} count={activeSummary.high_confidence_hotspots} total={activeSummary.total_hotspots} color="high" /><Bar label={t("wildfire.confidence.nominal")} count={activeSummary.nominal_confidence_hotspots} total={activeSummary.total_hotspots} color="nominal" /><Bar label={t("wildfire.confidence.low")} count={activeSummary.low_confidence_hotspots} total={activeSummary.total_hotspots} color="low" /></div></section><section className="wildfire-side-card"><h2>{t("wildfire.sources.title")}</h2><p>{event.source}</p><p className="wildfire-muted">{event.burned_area_ha == null ? t("wildfire.sources.noBurnedArea") : `${t("wildfire.sources.burnedAreaNote")}: ${event.burned_area_source}`}</p><small>{event.methodology}</small></section>{query.panel === "methodology" && <section className="wildfire-side-card"><h2>{t("wildfire.methodology.title")}</h2><p>{event.methodology}</p><ul>{event.limitations.map((item) => <li key={item}>{item}</li>)}</ul></section>}</aside></div></div>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className={`wildfire-stat wildfire-stat-${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) { return <div className="wildfire-bar-row"><div><span>{label}</span><strong>{count.toLocaleString("id-ID")}</strong></div><div className="wildfire-bar-track"><i className={`wildfire-bar-${color}`} style={{ width: `${total ? Math.min(100, count / total * 100) : 0}%` }} /></div></div>; }
export function adaptLegacyEvent(event: Partial<WildfireEvent> | DisasterEventListItem) {
  const raw = event as Omit<Partial<WildfireEvent>, "status"> & { name?: string | null; province?: string[]; event_date?: string | null; status?: string; description?: string | null };
  const slug = String(raw.slug ?? raw.name ?? "wildfire-event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { ...FALLBACK_WILDFIRE_EVENTS[0], ...raw, id: raw.id ?? slug, slug, title: raw.title ?? raw.name ?? slug, short_title: raw.short_title ?? raw.name ?? slug, disaster_type: "forest_fire", status: raw.status === "published" ? "active" : raw.status ?? "monitoring", start_date: raw.start_date ?? raw.event_date ?? FALLBACK_WILDFIRE_EVENTS[0].start_date, monitoring_from: raw.monitoring_from ?? raw.start_date ?? FALLBACK_WILDFIRE_EVENTS[0].monitoring_from, provinces: raw.provinces ?? raw.province ?? [], province_codes: raw.province_codes ?? [], city_codes: raw.city_codes ?? [], bbox: raw.bbox ?? FALLBACK_WILDFIRE_EVENTS[0].bbox, center_lat: raw.center_lat ?? FALLBACK_WILDFIRE_EVENTS[0].center_lat, center_lon: raw.center_lon ?? FALLBACK_WILDFIRE_EVENTS[0].center_lon, default_zoom: raw.default_zoom ?? 5, source: raw.source ?? "NASA FIRMS", hotspot_count: raw.hotspot_count ?? 0, high_confidence_count: raw.high_confidence_count ?? 0, burned_area_ha: raw.burned_area_ha ?? null, burned_area_source: raw.burned_area_source ?? null, updated_at: raw.updated_at ?? null, limitations: raw.limitations ?? [], source_ids: raw.source_ids ?? ["nasa-firms"] } as WildfireEvent;
}

export function useWildfireEventsFallback() { return FALLBACK_WILDFIRE_EVENTS; }
