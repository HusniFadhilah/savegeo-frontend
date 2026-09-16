import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "@/services/apiClient";
import { useI18nStore } from "@/hooks/useI18nStore";
import { fetchFirmsFires, fetchFirmsSources } from "../api";
import { featureContainsPoint } from "../lib/fireLayers";
import type {
  DisasterAoiRecord,
  FirmsFireResponse,
  FirmsHotspotFeature,
  FirmsLayerState,
  FirmsQueryState,
  FirmsSourceId,
  FirmsSourcesResponse,
} from "../types";
import { parseFirmsQuery, writeFirmsQuery } from "../lib/firmsQueryState";

interface Props {
  aoi: DisasterAoiRecord | null;
  onChange: (state: FirmsLayerState) => void;
  onZoom: (features: FirmsHotspotFeature[]) => void;
}

const FALLBACK_SOURCES = [
  ["VIIRS_NOAA20_NRT", "VIIRS NOAA-20"],
  ["VIIRS_NOAA21_NRT", "VIIRS NOAA-21"],
  ["VIIRS_SNPP_NRT", "VIIRS Suomi-NPP"],
  ["MODIS_NRT", "MODIS Terra/Aqua"],
  ["LANDSAT_NRT", "Landsat NRT"],
] as const;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function csvValue(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filteredSummary(features: FirmsHotspotFeature[]) {
  const frps = features.map((feature) => feature.properties.frp).filter((value): value is number => value != null);
  return {
    total: features.length,
    high: features.filter((feature) => feature.properties.confidence_label === "high").length,
    totalFrp: frps.reduce((sum, value) => sum + value, 0),
    maxFrp: frps.length ? Math.max(...frps) : 0,
  };
}

export default function FirmsHotspotPanel({ aoi, onChange, onZoom }: Props) {
  const t = useI18nStore((state) => state.t);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState<FirmsQueryState>(() => parseFirmsQuery(searchParams.toString()));
  const [sources, setSources] = useState<FirmsSourcesResponse | null>(null);
  const [result, setResult] = useState<FirmsFireResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timelineCutoff, setTimelineCutoff] = useState<number | null>(null);
  const generation = useRef(0);

  const updateQuery = (patch: Partial<FirmsQueryState>) => setQuery((current) => ({ ...current, ...patch }));

  useEffect(() => {
    setSearchParams(writeFirmsQuery(searchParams, query), { replace: true });
    // `searchParams` is intentionally read as the current URL baseline; this
    // effect only writes the compact FIRMS keys when controls change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, setSearchParams]);

  useEffect(() => {
    if (!query.enabled) return undefined;
    let cancelled = false;
    fetchFirmsSources()
      .then((payload) => {
        if (!cancelled) setSources(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [query.enabled]);

  const bbox = aoi?.bbox;
  const { enabled, source, period, historicalDate, minConfidence, minFrp, highOnly } = query;
  useEffect(() => {
    if (!enabled) return undefined;
    if (!bbox) {
      setError(t("disaster.firms.aoiRequired"));
      return undefined;
    }
    if (period === "historical" && !historicalDate) {
      setError(t("disaster.firms.historicalDateRequired"));
      return undefined;
    }
    const current = ++generation.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void fetchFirmsFires({
        source,
        day_range: period === "historical" ? 1 : Number(period),
        date: period === "historical" ? historicalDate : undefined,
        west: bbox[0],
        south: bbox[1],
        east: bbox[2],
        north: bbox[3],
        min_confidence: highOnly ? Math.max(80, minConfidence) : minConfidence || undefined,
        min_frp: minFrp ? Number(minFrp) : undefined,
        limit: 2000,
      })
        .then((payload) => {
          if (generation.current !== current) return;
          setResult(payload);
          setTimelineCutoff(null);
        })
        .catch((reason) => {
          if (generation.current === current) {
            setResult(null);
            setError(errorText(reason, t("disaster.firms.error")));
          }
        })
        .finally(() => {
          if (generation.current === current) setLoading(false);
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [bbox, enabled, highOnly, historicalDate, minConfidence, minFrp, period, source, t]);

  const visibleFeatures = useMemo(() => {
    const all = result?.features ?? [];
    const aoiFeature = aoi?.geojson?.type === "Feature"
      ? aoi.geojson
      : aoi?.geojson
        ? { type: "Feature" as const, properties: {}, geometry: aoi.geojson }
        : null;
    return all.filter((feature) => {
      if (aoiFeature && !featureContainsPoint(aoiFeature as GeoJSON.Feature, feature.geometry.coordinates)) return false;
      if (query.dayOnly && feature.properties.daynight?.toUpperCase() !== "D") return false;
      if (timelineCutoff != null && feature.properties.acq_datetime_utc) {
        return new Date(feature.properties.acq_datetime_utc).getTime() <= timelineCutoff;
      }
      return true;
    });
  }, [aoi?.geojson, query.dayOnly, result, timelineCutoff]);

  useEffect(() => {
    onChange({ enabled: query.enabled, result, features: visibleFeatures, showLabels: query.showLabels, cluster: query.cluster });
  }, [onChange, query.cluster, query.enabled, query.showLabels, result, visibleFeatures]);

  const timelineValues = useMemo(
    () => visibleFeatures.map((feature) => feature.properties.acq_datetime_utc ? new Date(feature.properties.acq_datetime_utc).getTime() : 0).filter((value) => value > 0),
    [visibleFeatures],
  );
  const timelineMin = timelineValues.length ? Math.min(...timelineValues) : 0;
  const timelineMax = timelineValues.length ? Math.max(...timelineValues) : 0;
  const summary = filteredSummary(visibleFeatures);
  const sourceItems = sources?.sources ?? FALLBACK_SOURCES.map(([id, label]) => ({ id, label, sensor: "", resolution_m: 0, available: true, status: "unknown" })) as FirmsSourcesResponse["sources"];

  function exportCsv() {
    const headers = ["id", "latitude", "longitude", "acq_date", "acq_time", "acq_datetime_utc", "satellite", "instrument", "confidence", "confidence_label", "frp", "bright_ti4", "bright_ti5", "scan", "track", "daynight", "source"];
    const rows = visibleFeatures.map((feature) => headers.map((header) => csvValue(header === "id" ? feature.id : feature.properties[header as keyof typeof feature.properties])));
    download("firms-hotspots.csv", [headers.join(","), ...rows.map((row) => row.join(","))].join("\n"), "text/csv;charset=utf-8");
  }

  function exportGeojson() {
    download("firms-hotspots.geojson", JSON.stringify({ type: "FeatureCollection", features: visibleFeatures, metadata: { source: query.source, period: query.period, fetched_at: result?.metadata.fetched_at, attribution: t("disaster.firms.attribution"), disclaimer: t("disaster.firms.disclaimer") } }, null, 2), "application/geo+json");
  }

  return (
    <section className="card mb-3 disaster-modern-card firms-hotspot-panel" aria-labelledby="firms-panel-title">
      <div className="card-header py-2 disaster-soft-header d-flex align-items-center gap-2">
        <span id="firms-panel-title"><i className="bi bi-fire" /> {t("disaster.firms.title")}</span>
        <span className={`badge ms-auto ${sources?.configured ? "text-bg-success" : "text-bg-warning"}`}>
          {sources?.configured ? "NASA FIRMS" : t("disaster.firms.notConfigured")}
        </span>
      </div>
      <div className="card-body py-2">
        <p className="small text-muted mb-2">{t("disaster.firms.description")}</p>
        {!sources?.configured && sources && <div className="alert alert-warning py-2 small">{t("disaster.firms.notConfigured")}</div>}
        <div className="form-check form-switch mb-2">
          <input className="form-check-input" type="checkbox" id="firms-enabled" checked={query.enabled} onChange={(event) => updateQuery({ enabled: event.target.checked })} />
          <label className="form-check-label small fw-semibold" htmlFor="firms-enabled">{t("disaster.firms.enabled")}</label>
        </div>
        <fieldset disabled={!query.enabled || loading} className="firms-controls">
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label small mb-1" htmlFor="firms-source">{t("disaster.firms.source")}</label>
              <select id="firms-source" className="form-select form-select-sm" value={query.source} onChange={(event) => updateQuery({ source: event.target.value as FirmsSourceId })}>
                <option value="all">{t("disaster.firms.allSources")}</option>
                {sourceItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small mb-1" htmlFor="firms-period">{t("disaster.firms.period")}</label>
              <select id="firms-period" className="form-select form-select-sm" value={query.period} onChange={(event) => updateQuery({ period: event.target.value as FirmsQueryState["period"] })}>
                <option value="1">{t("disaster.firms.last24h")}</option><option value="2">{t("disaster.firms.last48h")}</option><option value="3">{t("disaster.firms.last72h")}</option><option value="7">{t("disaster.firms.last7days")}</option><option value="historical">{t("disaster.firms.historicalDate")}</option>
              </select>
            </div>
            <div className="col-6">
              <label className="form-label small mb-1" htmlFor="firms-date">{t("disaster.firms.historicalDate")}</label>
              <input id="firms-date" className="form-control form-control-sm" type="date" max={todayUtc()} value={query.historicalDate} disabled={query.period !== "historical"} onChange={(event) => updateQuery({ historicalDate: event.target.value })} />
            </div>
            <div className="col-12">
              <label className="form-label small mb-1" htmlFor="firms-confidence">{t("disaster.firms.minConfidence")}: {query.minConfidence}</label>
              <input id="firms-confidence" className="form-range" type="range" min="0" max="100" step="5" value={query.minConfidence} onChange={(event) => updateQuery({ minConfidence: Number(event.target.value) })} />
            </div>
            <div className="col-6">
              <label className="form-label small mb-1" htmlFor="firms-frp">{t("disaster.firms.minFrp")}</label>
              <input id="firms-frp" className="form-control form-control-sm" type="number" min="0" step="0.1" value={query.minFrp} onChange={(event) => updateQuery({ minFrp: event.target.value })} />
            </div>
            <div className="col-6 d-flex flex-column justify-content-end small">
              <label><input type="checkbox" className="form-check-input me-1" checked={query.showLabels} onChange={(event) => updateQuery({ showLabels: event.target.checked })} />{t("disaster.firms.showLabels")}</label>
              <label><input type="checkbox" className="form-check-input me-1" checked={query.cluster} onChange={(event) => updateQuery({ cluster: event.target.checked })} />{t("disaster.firms.cluster")}</label>
            </div>
            <div className="col-12 small">
              <label className="me-3"><input type="checkbox" className="form-check-input me-1" checked={query.dayOnly} onChange={(event) => updateQuery({ dayOnly: event.target.checked })} />{t("disaster.firms.dayOnly")}</label>
              <label><input type="checkbox" className="form-check-input me-1" checked={query.highOnly} onChange={(event) => updateQuery({ highOnly: event.target.checked })} />{t("disaster.firms.highOnly")}</label>
            </div>
          </div>
        </fieldset>
        <div className="d-flex flex-wrap gap-2 mt-2">
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={!query.enabled || loading || !aoi} onClick={() => updateQuery({ enabled: true })}><i className={`bi ${loading ? "bi-arrow-repeat spin" : "bi-arrow-clockwise"}`} /> {t("disaster.firms.refresh")}</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!visibleFeatures.length} onClick={() => onZoom(visibleFeatures)}><i className="bi bi-zoom-in" /> {t("disaster.firms.zoomToHotspots")}</button>
          <button type="button" className="btn btn-sm btn-outline-success" disabled={!visibleFeatures.length} onClick={exportCsv}><i className="bi bi-filetype-csv" /> {t("disaster.firms.exportCsv")}</button>
          <button type="button" className="btn btn-sm btn-outline-success" disabled={!visibleFeatures.length} onClick={exportGeojson}><i className="bi bi-filetype-json" /> {t("disaster.firms.exportGeojson")}</button>
        </div>
        {!aoi && <div className="alert alert-info py-2 small mt-2 mb-0">{t("disaster.firms.aoiRequired")}</div>}
        {loading && <div className="small text-muted mt-2" role="status"><span className="spinner-border spinner-border-sm me-1" />{t("disaster.firms.loading")}</div>}
        {error && <div className="alert alert-warning py-2 small mt-2 mb-0" role="alert">{error}</div>}
        {result && !loading && !error && (
          <div className="mt-2" aria-live="polite">
            <div className="row g-1 small text-center">
              <div className="col-3"><strong>{summary.total.toLocaleString()}</strong><span className="d-block text-muted">{t("disaster.firms.totalHotspots")}</span></div>
              <div className="col-3"><strong>{summary.high.toLocaleString()}</strong><span className="d-block text-muted">{t("disaster.firms.highConfidence")}</span></div>
              <div className="col-3"><strong>{summary.totalFrp.toFixed(1)}</strong><span className="d-block text-muted">{t("disaster.firms.totalFrp")}</span></div>
              <div className="col-3"><strong>{summary.maxFrp.toFixed(1)}</strong><span className="d-block text-muted">FRP max</span></div>
            </div>
            {timelineValues.length > 1 && (
              <label className="small d-block mt-2">Timeline UTC
                <input className="form-range" type="range" min={timelineMin} max={timelineMax} value={timelineCutoff ?? timelineMax} onChange={(event) => setTimelineCutoff(Number(event.target.value))} />
              </label>
            )}
            <div className="small text-muted">{t("disaster.firms.lastUpdated")}: {new Date(result.metadata.fetched_at).toLocaleString()} {result.metadata.cached ? "· cached" : ""}{result.metadata.stale ? " · stale" : ""}</div>
            <div className="small text-muted mt-1">{t("disaster.firms.disclaimer")}</div>
            <a className="small" href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">{t("disaster.firms.attribution")}</a>
            {result.metadata.errors.length > 0 && <div className="small text-warning mt-1">{result.metadata.errors.map((item) => `${item.source}: ${item.message}`).join(" · ")}</div>}
          </div>
        )}
        {result && !loading && !visibleFeatures.length && <div className="alert alert-secondary py-2 small mt-2 mb-0">{t("disaster.firms.empty")}</div>}
      </div>
    </section>
  );
}
