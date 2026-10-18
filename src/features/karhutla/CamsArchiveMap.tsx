import { useCallback, useEffect, useMemo, useState } from "react";
import { GeoJSON as LeafletGeoJSON, TileLayer, useMap } from "react-leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import AoiDrawingTools from "@/components/map/AoiDrawingTools";
import { env } from "@/config/env";
import { plainTextContent } from "@/lib/leafletText";
import { fetchWildfireCamsAggregate, fetchWildfireCamsArchive } from "@/features/disaster/api";
import { useI18nStore } from "@/hooks/useI18nStore";
import type { AoiFeature } from "@/types/map";
import type { CamsAggregateSummary, CamsArchive, CamsAreaAggregate, CamsFrame, CamsGridAggregate, CamsSummary } from "./types";
import CamsPointProbe from "./CamsPointProbe";

function summaryValue(summary: CamsSummary): number | null {
  if (summary.integrated_mass_kg !== undefined) return summary.integrated_mass_kg === null ? null : summary.integrated_mass_kg / 1000;
  return summary.area_weighted_mean ?? null;
}

function filterCamsFrames(frames: CamsFrame[], from: string, to: string): CamsFrame[] {
  return frames.filter((frame) => (!from || frame.valid_at.slice(0, 10) >= from) && (!to || frame.valid_at.slice(0, 10) <= to));
}

function paletteColor(value: number, maximum: number, palette: string[]) {
  const position = maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
  const index = Math.min(palette.length - 1, Math.round(position * (palette.length - 1)));
  return `#${palette[index]}`;
}

function GridAggregationLayer({
  slug,
  layerId,
  frameId,
  palette,
  onResult,
}: {
  slug: string;
  layerId: string;
  frameId: string;
  palette: string[];
  onResult: (result: CamsGridAggregate | null, loading: boolean, error: boolean) => void;
}) {
  const map = useMap();
  const [result, setResult] = useState<CamsGridAggregate | null>(null);
  useEffect(() => {
    let active = true;
    let requestVersion = 0;
    const load = () => {
      const currentRequest = ++requestVersion;
      const bounds = map.getBounds();
      onResult(null, true, false);
      fetchWildfireCamsAggregate(slug, layerId, frameId, {
        mode: "grid",
        bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      }).then((value) => {
        if (!active || currentRequest !== requestVersion) return;
        const grid = value as CamsGridAggregate;
        setResult(grid);
        onResult(grid, false, false);
      }).catch(() => {
        if (!active || currentRequest !== requestVersion) return;
        setResult(null);
        onResult(null, false, true);
      });
    };
    load();
    map.on("moveend", load);
    return () => {
      active = false;
      map.off("moveend", load);
    };
  }, [frameId, layerId, map, onResult, slug]);

  if (!result) return null;
  return <LeafletGeoJSON
    data={result}
    style={(feature) => ({
      color: "#fff",
      weight: 0.65,
      fillColor: paletteColor(Number(feature?.properties?.value ?? 0), result.maximum, palette),
      fillOpacity: 0.82,
    })}
    onEachFeature={(feature, layer) => {
      const value = feature.properties?.value;
      if (typeof value === "number") layer.bindTooltip(plainTextContent(`${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${result.unit}`));
    }}
  />;
}

function SummaryMetrics({ summary, t }: { summary: CamsAggregateSummary; t: (key: string) => string }) {
  const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return <div className="cams-aggregate-metrics">
    <span>{t("wildfire.cams.validCells")} <strong>{number(summary.valid_cell_count)}</strong></span>
    <span>{t("wildfire.cams.rasterArea")} <strong>{number(summary.area_km2)} km²</strong></span>
    <span>{t("wildfire.cams.areaWeightedMean")} <strong>{number(summary.area_weighted_mean)} {summary.unit}</strong></span>
    {summary.integrated_mass_kg != null && <span>{t("wildfire.cams.integratedEmission")} <strong>{number(summary.integrated_mass_kg / 1000)} t C</strong></span>}
  </div>;
}

export default function CamsArchiveMap({ slug, onSelectionChange }: {
  slug: string;
  onSelectionChange?: (layerId: "burnt_carbon" | "organic_aod", frameId: string, opacity: number) => void;
}) {
  const { t, language } = useI18nStore();
  const [archive, setArchive] = useState<CamsArchive | null>(null);
  const [error, setError] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [layerId, setLayerId] = useState("burnt_carbon");
  const [selectedId, setSelectedId] = useState("");
  const [region, setRegion] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [playing, setPlaying] = useState(false);
  const [opacity, setOpacity] = useState(0.75);
  const [aggregationMode, setAggregationMode] = useState<"raster" | "province" | "grid" | "area">("raster");
  const [customArea, setCustomArea] = useState<AoiFeature | null>(null);
  const [areaAggregate, setAreaAggregate] = useState<CamsAreaAggregate | null>(null);
  const [areaLoading, setAreaLoading] = useState(false);
  const [areaError, setAreaError] = useState(false);
  const [gridAggregate, setGridAggregate] = useState<CamsGridAggregate | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setArchive(null);
    setError(false);
    fetchWildfireCamsArchive(slug).then((data) => {
      if (cancelled) return;
      setArchive(data);
      setLayerId(data.layers.burnt_carbon ? "burnt_carbon" : Object.keys(data.layers)[0]);
      setSelectedId("");
    }, () => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [slug, retry]);

  const layer = archive?.layers[layerId];
  const frames = useMemo(() => filterCamsFrames(layer?.frames ?? [], from, to), [layer, from, to]);
  const frame = frames.find((item) => item.id === selectedId) ?? frames.filter((item) => !item.is_forecast).at(-1) ?? frames.at(-1);
  const index = frame ? frames.indexOf(frame) : 0;
  const frameId = frame?.id;
  const isCarbon = layerId === "burnt_carbon";
  const unit = isCarbon ? "t C" : "AOD";
  const handleGridResult = useCallback((result: CamsGridAggregate | null, loading: boolean, error: boolean) => {
    setGridAggregate(result);
    setGridLoading(loading);
    setGridError(error);
  }, []);
  useEffect(() => {
    if (aggregationMode !== "area" || !customArea || !frameId) {
      setAreaAggregate(null);
      setAreaLoading(false);
      setAreaError(false);
      return undefined;
    }
    let cancelled = false;
    setAreaLoading(true);
    setAreaError(false);
    fetchWildfireCamsAggregate(slug, layerId, frameId, { mode: "area", geometry: customArea })
      .then((result) => { if (!cancelled) setAreaAggregate(result as CamsAreaAggregate); })
      .catch(() => { if (!cancelled) setAreaError(true); })
      .finally(() => { if (!cancelled) setAreaLoading(false); });
    return () => { cancelled = true; };
  }, [aggregationMode, customArea, frameId, layerId, slug]);
  useEffect(() => {
    if (frameId && (layerId === "burnt_carbon" || layerId === "organic_aod")) {
      onSelectionChange?.(layerId, frameId, opacity);
    }
  }, [frameId, layerId, opacity, onSelectionChange]);
  useEffect(() => { setTileError(false); }, [frameId, layerId]);
  useEffect(() => {
    if (!playing || frames.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (index >= frames.length - 1) setPlaying(false);
      else setSelectedId(frames[index + 1].id);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, frames, index]);

  const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString(language === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 3 });
  const date = (value: string) => new Date(value).toLocaleString(language === "id" ? "id-ID" : "en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
  const regionSummary = frame?.regions.find((item) => item.code === region)?.summary ?? frame?.summary;
  const chartValues = frames.map((item) => summaryValue(item.regions.find((r) => r.code === region)?.summary ?? item.summary));
  const chartMaximum = Math.max(...chartValues.filter((value): value is number => value !== null), 0.000001);
  const topRegions = [...(frame?.regions ?? [])]
    .map((item) => ({ ...item, value: summaryValue(item.summary) }))
    .filter((item) => item.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 5);
  const historicalTotals = useMemo(() => {
    const byYear = new Map<string, { total: number; weight: number }>();
    for (const item of layer?.frames ?? []) {
      if (item.is_forecast) continue;
      const value = summaryValue(item.summary);
      if (value == null) continue;
      const year = item.valid_at.slice(0, 4);
      const current = byYear.get(year) ?? { total: 0, weight: 0 };
      if (isCarbon) {
        current.total += value;
      } else {
        const weight = item.summary.valid_cell_count;
        current.total += value * weight;
        current.weight += weight;
      }
      byYear.set(year, current);
    }
    return [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, item]) => ({
      year,
      value: isCarbon ? item.total : item.weight ? item.total / item.weight : null,
    }));
  }, [isCarbon, layer]);
  const apiPrefix = `${env.apiBaseUrl}/disasters/wildfires/events/${encodeURIComponent(slug)}/emissions`;

  const exportCsv = () => {
    const rows: unknown[][] = [["valid_time_utc", "interval_end_utc", "region_code", "value", "unit", "forecast", "source_url"],
      ...frames.map((item) => [item.valid_at, item.interval_end ?? "", region,
        summaryValue(item.regions.find((r) => r.code === region)?.summary ?? item.summary) ?? "", unit, item.is_forecast, item.provenance.source_url])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${slug}_${layerId}_summary.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (error) return <div role="alert">{t("wildfire.cams.error")} <button type="button" onClick={() => setRetry((value) => value + 1)}>{t("wildfire.cams.retry")}</button></div>;
  if (!archive || !layer) return <div role="status">{t("wildfire.cams.loading")}</div>;
  return <div className="cams-archive">
    <div className="cams-archive-controls">
      <label>{t("wildfire.cams.layer")}<select value={layerId} onChange={(event) => {
        setLayerId(event.target.value); setSelectedId(""); setPlaying(false); setFrom(""); setTo("");
      }}>{Object.keys(archive.layers).map((id) => <option key={id} value={id}>{t(`wildfire.cams.layer.${id}`)}</option>)}</select></label>
      <label>{t("wildfire.cams.aggregateBy")}<select value={aggregationMode} onChange={(event) => {
        setAggregationMode(event.target.value as typeof aggregationMode);
        setGridAggregate(null); setAreaAggregate(null); setGridError(false); setAreaError(false);
      }}>
        <option value="raster">{t("wildfire.cams.aggregateRaster")}</option>
        <option value="province">{t("wildfire.cams.aggregateProvince")}</option>
        <option value="grid">{t("wildfire.cams.aggregateGrid")}</option>
        <option value="area">{t("wildfire.cams.aggregateArea")}</option>
      </select></label>
      {aggregationMode === "province" && <label>{t("wildfire.cams.region")}<select value={region} onChange={(event) => setRegion(event.target.value)}>
        <option value="">{t("wildfire.cams.allRegions")}</option>
        {layer.frames[0]?.regions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
      </select></label>}
      <label>{t("wildfire.cams.from")}<input type="date" value={from || layer.frames[0]?.valid_at.slice(0, 10) || ""} onChange={(event) => { setFrom(event.target.value); setPlaying(false); }} /></label>
      <label>{t("wildfire.cams.to")}<input type="date" value={to || layer.frames.at(-1)?.valid_at.slice(0, 10) || ""} onChange={(event) => { setTo(event.target.value); setPlaying(false); }} /></label>
    </div>
    {!frame ? <p role="status">{t("wildfire.cams.noFrames")}</p> : <>
      <div className="cams-archive-heading">
        <strong>{date(frame.valid_at)} UTC {frame.is_forecast ? `· ${t("wildfire.cams.forecast")}` : ""}</strong>
        <span>{t(isCarbon ? "wildfire.cams.total" : "wildfire.cams.mean")}: <b>{number(regionSummary && summaryValue(regionSummary))}</b> {unit}</span>
      </div>
      {tileError && <p role="alert">{t("wildfire.cams.tileError")}</p>}
      <div className="cams-archive-map">
        <MapView id={`cams-${slug}`} center={[(archive.bbox[1] + archive.bbox[3]) / 2, (archive.bbox[0] + archive.bbox[2]) / 2]} zoom={6} maxZoom={12} showGlobeControl={false}>
          <BasemapSwitcher />
          {aggregationMode !== "grid" && <TileLayer key={`${layerId}-${frame.id}`} url={`${apiPrefix}/tiles/${layerId}/${frame.id}/{z}/{x}/{y}.png?v=${frame.sha256.slice(0, 12)}&render=2`} opacity={opacity}
            attribution="CAMS / ECMWF · ADS · CC-BY 4.0" eventHandlers={{ tileerror: () => setTileError(true) }} />}
          {aggregationMode === "grid" && <GridAggregationLayer slug={slug} layerId={layerId} frameId={frame.id} palette={layer.palette} onResult={handleGridResult} />}
          {aggregationMode === "area" && <AoiDrawingTools onChange={setCustomArea} />}
          {aggregationMode !== "area" && <CamsPointProbe slug={slug} layers={[{ layerId, frameId: frame.id }]} />}
        </MapView>
        <div className="cams-archive-legend">
          <strong>{layer.display_unit}</strong>
          <div style={{ background: `linear-gradient(to right, ${layer.palette.map((color) => `#${color}`).join(",")})` }} />
          <span>0 <b>{number(layer.rendering?.maximum ?? layer.maximum)}{layer.maximum > (layer.rendering?.maximum ?? layer.maximum) ? "+" : ""}</b></span>
        </div>
      </div>
      {aggregationMode === "grid" && <div className="cams-aggregation-result" role={gridError ? "alert" : "status"}>
        {gridLoading ? t("wildfire.cams.gridLoading") : gridError ? t("wildfire.cams.gridError") : gridAggregate ? <>
          <strong>{t("wildfire.cams.gridCells").replace("{count}", String(gridAggregate.features.length))}</strong>
          <SummaryMetrics summary={gridAggregate.summary} t={t} />
        </> : t("wildfire.cams.gridHint")}
      </div>}
      {aggregationMode === "area" && <div className="cams-aggregation-result" role={areaError ? "alert" : "status"}>
        {areaLoading ? t("wildfire.cams.areaLoading") : areaError ? t("wildfire.cams.areaError") : areaAggregate ? <SummaryMetrics summary={areaAggregate.summary} t={t} /> : t("wildfire.cams.areaHint")}
      </div>}
      <div className="cams-archive-playback">
        <button type="button" aria-label={t(playing ? "wildfire.cams.pause" : "wildfire.cams.play")} disabled={frames.length < 2} onClick={() => {
          if (!playing && index === frames.length - 1) setSelectedId(frames[0].id);
          setPlaying(!playing);
        }}><i className={`bi ${playing ? "bi-pause-fill" : "bi-play-fill"}`} aria-hidden="true" /></button>
        <input type="range" aria-label={t("wildfire.cams.timeSlider")} min={0} max={Math.max(0, frames.length - 1)} value={index}
          onChange={(event) => { setSelectedId(frames[Number(event.target.value)].id); setPlaying(false); }} />
        <span>{index + 1}/{frames.length}</span>
        <label>{t("wildfire.cams.opacity")}<input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label>
      </div>
      <div className="cams-archive-note">{layer.resolution_degrees}° · UTC
        <details><summary aria-label={t("wildfire.cams.methodology")}><i className="bi bi-info-circle" aria-hidden="true" /></summary>
          <p>{t(isCarbon ? "wildfire.cams.carbonInterval" : "wildfire.cams.aerosolNote")}</p>
        </details>
      </div>
      {frame.forecast_reference_time && <small>{t("wildfire.cams.cycle")}: {date(frame.forecast_reference_time)} UTC · +{frame.leadtime_hours} h</small>}
      <h4 className="cams-archive-subheading">{t("wildfire.cams.dailyTotals")}</h4>
      <svg className="cams-archive-chart" viewBox="0 0 600 110" role="img" aria-label={t("wildfire.cams.chart")}>
        {chartValues.map((value, position) => value === null ? null : <rect key={frames[position].id} x={position * 600 / frames.length + 1}
          y={100 - value / chartMaximum * 95} width={Math.max(1, 600 / frames.length - 2)} height={value / chartMaximum * 95}
          fill={position === index ? "#ff8a00" : frames[position].is_forecast ? "#a318a6" : "#0d8077"}
          onClick={() => { setSelectedId(frames[position].id); setPlaying(false); }}>
          <title>{date(frames[position].valid_at)} UTC: {number(value)} {unit}</title>
        </rect>)}
      </svg>
      <div className="cams-archive-chart-labels"><span>{date(frames[0].valid_at)}</span><span>{date(frames.at(-1)!.valid_at)} UTC</span></div>
      <details className="cams-archive-regions"><summary>{t("wildfire.cams.topRegions")}</summary>
        {topRegions.length ? <ol>{topRegions.map((item) => <li key={item.code}><span>{item.name}</span><strong>{number(item.value)} {unit}</strong></li>)}</ol> : <p>{t("wildfire.cams.noRegionStats")}</p>}
      </details>
      <details className="cams-archive-regions"><summary>{t("wildfire.cams.historicalTotals")}</summary>
        {historicalTotals.length ? <table><thead><tr><th>{t("wildfire.cams.year")}</th><th>{t(isCarbon ? "wildfire.cams.total" : "wildfire.cams.mean")} ({isCarbon ? "t C" : "AOD"})</th></tr></thead>
          <tbody>{historicalTotals.map((item) => <tr key={item.year}><td>{item.year}</td><td>{number(item.value)}</td></tr>)}</tbody></table> : <p>{t("wildfire.cams.noHistoricalData")}</p>}
      </details>
      <details className="cams-archive-regions"><summary>{t("wildfire.cams.provinceStatistics")}</summary>
        <table><thead><tr><th>{t("wildfire.cams.region")}</th><th>{t(isCarbon ? "wildfire.cams.total" : "wildfire.cams.mean")} ({unit})</th></tr></thead>
          <tbody>{frame.regions.map((item) => <tr key={item.code}><td>{item.name}</td><td>{number(summaryValue(item.summary))}</td></tr>)}</tbody>
        </table>
      </details>
      <div className="cams-archive-downloads">
        <button type="button" onClick={exportCsv}><i className="bi bi-download" aria-hidden="true" /> {t("wildfire.cams.downloadCsv")}</button>
        <a href={`${apiPrefix}/download/${layerId}/${frame.id}.tif`}>{t("wildfire.cams.downloadRaster")} ({layer.source_unit})</a>
        <a href={frame.provenance.source_url} target="_blank" rel="noreferrer">{t("wildfire.cams.openCatalog")}</a>
      </div>
      <small>{t("wildfire.cams.archiveUpdated")}: {date(archive.updated_at)} UTC · CAMS / ECMWF, CC-BY 4.0</small>
    </>}
  </div>;
}
