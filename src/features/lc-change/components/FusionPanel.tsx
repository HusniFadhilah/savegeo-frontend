import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import MapCursorPosition from "@/components/map/MapCursorPosition";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import MapLegend from "@/components/map/MapLegend";
import { HIGH_DETAIL_MAX_ZOOM, nativeZoomForResolution } from "@/config/mapZoom";
import { RESULT_PANE } from "@/config/mapPanes";
import type { AoiFeature, MapLegendEntry } from "@/types/map";
import { formatNumber, useI18nStore } from "@/hooks/useI18nStore";

type Language = Parameters<typeof formatNumber>[1];
import { analyzeLandCoverFusion } from "../api";
import type { LcFusionMode, LcFusionPeriod, LcFusionResponse, LcFusionRoute } from "../types";
import { translateLulcClass } from "../utils";

interface Props {
  aoi: AoiFeature | null;
  yearA: number | null;
  yearB: number | null;
  startMonth: number;
  endMonth: number;
  startDateA?: string;
  endDateA?: string;
  startDateB?: string;
  endDateB?: string;
}

type LayerKind = "route" | "quality_optical" | "quality_sar" | "landcover" | "change";

const AOI_STYLE = { color: "#ef4444", weight: 2, fillOpacity: 0.04 };
const ROUTE_ORDER: LcFusionRoute[] = ["joint_fusion", "optical_dominant", "sar_dominant", "no_data"];
const ROUTE_COLOR: Record<LcFusionRoute, string> = {
  joint_fusion: "#059669",
  optical_dominant: "#f59e0b",
  sar_dominant: "#2563eb",
  no_data: "#94a3b8",
};
const LAYERS: { kind: LayerKind; translationKey: string }[] = [
  { kind: "route", translationKey: "lc.fusion.layer.route" },
  { kind: "quality_optical", translationKey: "lc.fusion.layer.qualityOptical" },
  { kind: "quality_sar", translationKey: "lc.fusion.layer.qualitySar" },
  { kind: "landcover", translationKey: "lc.fusion.layer.landcover" },
  { kind: "change", translationKey: "lc.fusion.layer.change" },
];

function routeLabel(route: LcFusionRoute, t: (key: string) => string): string {
  return t(`lc.fusion.route.${route}`);
}

function FitToAoi({ aoi }: { aoi: AoiFeature | null }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const bounds = L.geoJSON(aoi as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
  }, [aoi, map]);
  return null;
}

function RouteBar({ period, t }: { period: LcFusionPeriod; t: (key: string) => string }) {
  return (
    <div className="d-flex rounded overflow-hidden mb-1" style={{ height: 14 }} aria-label={t("lc.fusion.routesAria")}>
      {ROUTE_ORDER.map((route) => {
        const pct = period.routes.percentage[route] ?? 0;
        return pct > 0 ? (
          <div key={route} title={`${routeLabel(route, t)} ${pct.toFixed(1)}%`} style={{ width: `${pct}%`, background: ROUTE_COLOR[route] }} />
        ) : null;
      })}
    </div>
  );
}

function PeriodCard({ title, period, language, t }: { title: string; period: LcFusionPeriod; language: Language; t: (key: string) => string }) {
  return (
    <div className="border rounded p-2 h-100" style={{ fontSize: ".8rem" }}>
      <div className="fw-semibold mb-1">{title}</div>
      <div className="text-muted mb-2">
        {period.start_date} {t("lc.fusion.until")} {period.end_date} · S2 {period.scene_counts.sentinel2} {t("lc.fusion.scenes")} · S1 {period.scene_counts.sentinel1} {t("lc.fusion.scenes")}
      </div>
      <div className="d-flex gap-3 mb-2">
        <span>{t("lc.fusion.meanQo")} <strong>{period.mean_q_o.toFixed(2)}</strong></span>
        <span>{t("lc.fusion.meanQs")} <strong>{period.mean_q_s.toFixed(2)}</strong></span>
        <span>{t("lc.fusion.meanConfidence")} <strong>{period.mean_confidence.toFixed(2)}</strong></span>
      </div>
      <RouteBar period={period} t={t} />
      <div className="d-flex flex-wrap gap-2">
        {ROUTE_ORDER.map((route) => (
          <span key={route}>
            <span className="d-inline-block me-1 rounded-1" style={{ width: 10, height: 10, background: ROUTE_COLOR[route] }} />
            {routeLabel(route, t)}: {formatNumber(period.routes.area_ha[route] ?? 0, language)} ha ({(period.routes.percentage[route] ?? 0).toFixed(1)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Quality-gated optical/SAR fusion (POST /analyze/landcover-fusion). Every pixel
 * gets Q_o (Sentinel-2 validity x clear fraction x observation coverage) and
 * Q_s (Sentinel-1 validity x residual-speckle index x coverage). "routing"
 * picks the joint, optical or SAR classifier per pixel from q_min;
 * "weighted" blends optical and SAR class probabilities by Q_o/Q_s. Change
 * is the total-variation distance D = 1/2 sum_k |P_t0,k - P_t1,k|, valid only above tau_change and where
 * both periods pass the quality gate. Independent of the dataset picked for
 * the other tabs - it uses its own Sentinel-1/2 Random Forest classifiers.
 */
export default function FusionPanel({ aoi, yearA, yearB, startMonth, endMonth, startDateA, endDateA, startDateB, endDateB }: Props) {
  const { language, t } = useI18nStore();
  const [mode, setMode] = useState<LcFusionMode>("routing");
  const [qMin, setQMin] = useState(0.5);
  const [tauChange, setTauChange] = useState(0.2);
  const [scale, setScale] = useState(20);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LcFusionResponse | null>(null);
  const [layer, setLayer] = useState<LayerKind>("route");
  const [opacity, setOpacity] = useState(0.85);
  const generation = useRef(0);

  const canRun = !!aoi && yearA != null && yearB != null && yearA < yearB;

  useEffect(() => {
    generation.current += 1;
    setResult(null);
    setError(null);
  }, [aoi, yearA, yearB, startMonth, endMonth, startDateA, endDateA, startDateB, endDateB, mode, qMin, tauChange, scale]);

  const run = async () => {
    if (!aoi || yearA == null || yearB == null) return;
    const requested = generation.current;
    setRunning(true);
    setError(null);
    try {
      const response = await analyzeLandCoverFusion({
        aoi: { geojson: aoi },
        from_year: yearA,
        to_year: yearB,
        start_month: startMonth,
        end_month: endMonth,
        ...(startDateA && endDateA && startDateB && endDateB
          ? { from_start_date: startDateA, from_end_date: endDateA, to_start_date: startDateB, to_end_date: endDateB }
          : {}),
        fusion_mode: mode,
        q_min: qMin,
        tau_change: tauChange,
        scale,
      });
      if (requested !== generation.current) return;
      setResult(response);
    } catch (err) {
      if (requested !== generation.current) return;
      setError(err instanceof Error ? err.message : t("lc.fusion.error"));
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const tiles = result?.tiles;
  const [leftTile, rightTile] = useMemo((): [string | undefined, string | undefined] => {
    if (!tiles) return [undefined, undefined];
    switch (layer) {
      case "route": return [tiles.route_t0, tiles.route_t1];
      case "quality_optical": return [tiles.q_o_t0, tiles.q_o_t1];
      case "quality_sar": return [tiles.q_s_t0, tiles.q_s_t1];
      case "landcover": return [tiles.landcover_t0, tiles.landcover_t1];
      default: return [tiles.change_score, tiles.changed];
    }
  }, [tiles, layer]);

  const legend = useMemo((): { entries: MapLegendEntry[]; scale?: { min: number; max: number; unit: string; colors: string[] } } => {
    if (!result) return { entries: [] };
    if (layer === "route") return { entries: result.legends.route.map((item) => ({ color: item.color, label: item.label })) };
    if (layer === "quality_optical" || layer === "quality_sar") {
      return { entries: [], scale: { min: 0, max: 1, unit: "", colors: result.legends.quality.palette } };
    }
    return { entries: result.legends.landcover.map((item) => ({ color: item.color, label: translateLulcClass(item.label), value: item.value })) };
  }, [result, layer]);

  const nativeZoom = nativeZoomForResolution(Number.parseFloat(result?.resolution ?? "20"));
  const changedFlows = useMemo(() => (result?.flows ?? []).filter((flow) => flow.changed).slice(0, 12), [result]);
  const leftTitle = layer === "change" ? t("lc.fusion.changeScore") : `${t("lc.fusion.periodBase")} (${yearA ?? ""})`;
  const rightTitle = layer === "change" ? t("lc.fusion.validChange") : `${t("lc.fusion.periodCompare")} (${yearB ?? ""})`;

  return (
    <div>
      <div className="d-flex align-items-end gap-3 flex-wrap mb-3" style={{ fontSize: ".8rem" }}>
        <div>
          <label className="form-label mb-1" htmlFor="fusion-mode">{t("lc.fusion.mode")}</label>
          <select id="fusion-mode" className="form-select form-select-sm" value={mode} onChange={(e) => setMode(e.target.value as LcFusionMode)}>
            <option value="routing">{t("lc.fusion.routing")}</option>
            <option value="weighted">{t("lc.fusion.weighted")}</option>
          </select>
        </div>
        <div>
          <label className="form-label mb-1" htmlFor="fusion-qmin">{t("lc.fusion.qMin")}</label>
          <input id="fusion-qmin" type="number" className="form-control form-control-sm" style={{ width: 90 }} min={0} max={1} step={0.05}
            value={qMin} onChange={(e) => setQMin(Math.min(1, Math.max(0, Number(e.target.value))))} />
        </div>
        <div>
          <label className="form-label mb-1" htmlFor="fusion-tau">{t("lc.fusion.tau")}</label>
          <input id="fusion-tau" type="number" className="form-control form-control-sm" style={{ width: 90 }} min={0} max={1} step={0.05}
            value={tauChange} onChange={(e) => setTauChange(Math.min(1, Math.max(0, Number(e.target.value))))} />
        </div>
        <div>
          <label className="form-label mb-1" htmlFor="fusion-scale">{t("lc.fusion.scale")}</label>
          <select id="fusion-scale" className="form-select form-select-sm" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            <option value={10}>10 m · {t("lc.fusion.scaleDetailed")}</option>
            <option value={20}>20 m · {t("lc.fusion.scaleBalanced")}</option>
            <option value={30}>30 m · {t("lc.fusion.scaleFast")}</option>
          </select>
        </div>
        <button className="btn btn-success btn-sm fw-bold" disabled={!canRun || running} onClick={run}>
          {running ? <><i className="fas fa-spinner fa-spin" /> {t("lc.fusion.running")}</> : <><i className="fas fa-layer-group" /> {t("lc.fusion.run")}</>}
        </button>
      </div>

      <p className="text-muted mb-2" style={{ fontSize: ".78rem" }}>
        {t("lc.fusion.description")}
      </p>

      {!canRun && (
        <div className="alert alert-warning py-2 mb-2" style={{ fontSize: ".82rem" }}>
          {t("lc.fusion.needAoi")}
        </div>
      )}
      {error && <div role="alert" className="alert alert-danger py-2 mb-2" style={{ fontSize: ".82rem" }}>{error}</div>}

      {result && (
        <>
          <div className="row g-2 mb-3">
            <div className="col-md-6"><PeriodCard title={t("lc.fusion.periodBase")} period={result.periods.t0} language={language} t={t} /></div>
            <div className="col-md-6"><PeriodCard title={t("lc.fusion.periodCompare")} period={result.periods.t1} language={language} t={t} /></div>
          </div>

          <div className="d-flex flex-wrap gap-2 mb-3" style={{ fontSize: ".8rem" }}>
            {[
              [t("lc.fusion.validArea"), result.statistics.valid_area_ha],
              [t("lc.fusion.noData"), result.statistics.no_data_area_ha],
              [t("lc.fusion.validChange"), result.statistics.changed_area_ha],
              [t("lc.fusion.stable"), result.statistics.stable_area_ha],
              [t("lc.fusion.belowTau"), result.statistics.suppressed_change_area_ha],
            ].map(([label, value]) => (
              <span key={label as string} className="badge bg-light text-dark border">
                {label}: {formatNumber(value as number, language)} ha
              </span>
            ))}
            <span className="badge bg-light text-dark border">{t("lc.fusion.changePercent", { percent: result.statistics.changed_percentage.toFixed(2) })}</span>
            <span className="badge bg-light text-dark border">{t("lc.fusion.meanD", { value: result.statistics.mean_change_score.toFixed(3) })}</span>
          </div>

          <div className="d-flex align-items-center gap-2 mb-2">
            <label className="small mb-0" htmlFor="fusion-layer">{t("lc.fusion.mapLayer")}</label>
            <select id="fusion-layer" className="form-select form-select-sm" style={{ maxWidth: 320 }} value={layer} onChange={(e) => setLayer(e.target.value as LayerKind)}>
              {LAYERS.map((item) => <option key={item.kind} value={item.kind}>{t(item.translationKey)}</option>)}
            </select>
          </div>
        </>
      )}

      <div className="row g-2">
        {[{ id: "lcFusionMapT0", tile: leftTile, title: leftTitle }, { id: "lcFusionMapT1", tile: rightTile, title: rightTitle }].map((panel) => (
          <div className="col-md-6" key={panel.id}>
            <MapView id={panel.id} showGlobeControl={false}>
              <MapCursorPosition />
              <BasemapSwitcher />
              <LayerOpacityControl opacity={opacity} onChange={setOpacity} label={t("lc.mapOpacity")} />
              {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
              {panel.tile && (
                <TileLayer key={panel.tile} url={panel.tile} maxNativeZoom={nativeZoom} maxZoom={HIGH_DETAIL_MAX_ZOOM}
                  opacity={opacity} attribution="Google Earth Engine" pane={RESULT_PANE} />
              )}
              <FitToAoi aoi={aoi} />
            </MapView>
            {result && (
              layer === "change" && panel.id === "lcFusionMapT0"
                ? <MapLegend title={panel.title} entries={[]} scale={{ min: 0, max: 1, unit: "", colors: ["#f8fafc", "#fde047", "#dc2626"] }} />
                : <MapLegend title={panel.title} entries={legend.entries} scale={legend.scale} />
            )}
          </div>
        ))}
      </div>

      {result && (
        <div className="row g-3 mt-1">
          <div className="col-lg-7">
            <div className="fw-semibold mb-1" style={{ fontSize: ".85rem" }}>{t("lc.fusion.topTransitions")}</div>
            <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
              <table className="table table-sm mb-0" style={{ fontSize: ".78rem" }}>
                <thead className="table-primary sticky-top"><tr><th>{t("lc.fusion.from")}</th><th>{t("lc.fusion.to")}</th><th className="text-end">{t("lc.fusion.areaHa")}</th></tr></thead>
                <tbody>
                  {changedFlows.map((flow) => (
                    <tr key={`${flow.from_class}-${flow.to_class}`}>
                      <td><span className="d-inline-block me-1 rounded-1" style={{ width: 10, height: 10, background: flow.from_color }} />{translateLulcClass(flow.from)}</td>
                      <td><span className="d-inline-block me-1 rounded-1" style={{ width: 10, height: 10, background: flow.to_color }} />{translateLulcClass(flow.to)}</td>
                      <td className="text-end">{formatNumber(flow.area, language)}</td>
                    </tr>
                  ))}
                  {!changedFlows.length && <tr><td colSpan={3} className="text-center text-muted">{t("lc.fusion.noTransitions")}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-lg-5" style={{ fontSize: ".78rem" }}>
            <div className="fw-semibold mb-1" style={{ fontSize: ".85rem" }}>{t("lc.fusion.provenance")}</div>
            <ul className="mb-2 ps-3">
              <li>{t("lc.fusion.method", { method: result.method, mode: result.fusion_mode, qMin: result.parameters.q_min, tau: result.parameters.tau_change })}</li>
              <li>{t("lc.fusion.grid", { resolution: result.resolution, crs: result.comparison_crs })}</li>
              {result.training.training_sample_count != null && <li>{t("lc.fusion.trainingSamples", { count: result.training.training_sample_count })}</li>}
              {result.limitations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
