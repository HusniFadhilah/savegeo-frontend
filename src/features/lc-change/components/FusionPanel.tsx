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

type LayerKind = "route" | "quality_optical" | "quality_sar" | "landcover" | "change" | "common";

const AOI_STYLE = { color: "#ef4444", weight: 2, fillOpacity: 0.04 };
const ROUTE_ORDER: LcFusionRoute[] = [
  "joint_fusion",
  "optical_dominant",
  "sar_dominant",
  "no_data",
];
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
  { kind: "common", translationKey: "lc.fusion.layer.common" },
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
    <div
      className="d-flex rounded overflow-hidden mb-1"
      style={{ height: 14 }}
      aria-label={t("lc.fusion.routesAria")}
    >
      {ROUTE_ORDER.map((route) => {
        const pct = period.routes.percentage[route] ?? 0;
        return pct > 0 ? (
          <div
            key={route}
            title={`${routeLabel(route, t)} ${pct.toFixed(1)}%`}
            style={{ width: `${pct}%`, background: ROUTE_COLOR[route] }}
          />
        ) : null;
      })}
    </div>
  );
}

function PeriodCard({
  title,
  period,
  language,
  t,
}: {
  title: string;
  period: LcFusionPeriod;
  language: Language;
  t: (key: string) => string;
}) {
  return (
    <section className="card h-100 border shadow-sm">
      <div className="card-body p-3">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
          <h4 className="h6 fw-semibold mb-0">{title}</h4>
          <span className="badge rounded-pill bg-body-secondary text-body border">
            S2 {period.scene_counts.sentinel2} · S1 {period.scene_counts.sentinel1}{" "}
            {t("lc.fusion.scenes")}
          </span>
        </div>
        <div className="small text-muted mb-3">
          {period.start_date} {t("lc.fusion.until")} {period.end_date}
        </div>
        <div className="row g-2 mb-3">
          {[
            {
              label: (
                <>
                  <var>Q</var>
                  <sub>o</sub>
                </>
              ),
              value: period.mean_q_o,
            },
            {
              label: (
                <>
                  <var>Q</var>
                  <sub>s</sub>
                </>
              ),
              value: period.mean_q_s,
            },
            { label: t("lc.fusion.meanConfidence"), value: period.mean_confidence },
          ].map((metric, index) => (
            <div className="col-4" key={index}>
              <div className="rounded-2 bg-body-tertiary px-2 py-2 h-100">
                <div className="small text-muted">{metric.label}</div>
                <div className="fs-5 fw-semibold lh-1 mt-1">{metric.value.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
        <RouteBar period={period} t={t} />
        <div className="row row-cols-1 row-cols-sm-2 g-2 mt-1 small">
          {ROUTE_ORDER.map((route) => (
            <div className="col" key={route}>
              <div className="d-flex align-items-start gap-2">
                <span
                  className="rounded-circle mt-1 flex-shrink-0"
                  style={{ width: 9, height: 9, background: ROUTE_COLOR[route] }}
                />
                <span>
                  {routeLabel(route, t)}{" "}
                  <strong>{(period.routes.percentage[route] ?? 0).toFixed(1)}%</strong>
                  <span className="d-block text-muted">
                    {formatNumber(period.routes.area_ha[route] ?? 0, language)} ha
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Quality-gated optical/SAR fusion (POST /analyze/landcover-fusion). Every pixel
 * gets Q_o (Sentinel-2 validity x clear fraction x observation coverage) and
 * Q_s (Sentinel-1 validity x residual-speckle index x coverage). "routing"
 * picks the joint, optical or SAR classifier per pixel from q_min;
 * "weighted" blends optical and SAR class probabilities by Q_o/Q_s. Change
 * is the total-variation distance D = 1/2 sum_k |P_t0,k - P_t1,k| computed on the
 * *common path*: the same classifier for t0 and t1, chosen from the sources that
 * pass q_min in both periods, so a model switch between periods is never read as
 * change. An optional event extent (SAR new-water between two dates) restricts
 * change and class areas. Independent of the dataset picked for
 * the other tabs - it uses its own Sentinel-1/2 Random Forest classifiers.
 */
export default function FusionPanel({
  aoi,
  yearA,
  yearB,
  startMonth,
  endMonth,
  startDateA,
  endDateA,
  startDateB,
  endDateB,
}: Props) {
  const { language, t } = useI18nStore();
  const [mode, setMode] = useState<LcFusionMode>("routing");
  const [qMin, setQMin] = useState(0.5);
  const [tauChange, setTauChange] = useState(0.2);
  const [cMin, setCMin] = useState("");
  const [scale, setScale] = useState(20);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LcFusionResponse | null>(null);
  const [layer, setLayer] = useState<LayerKind>("route");
  const [opacity, setOpacity] = useState(0.85);
  const [eventOn, setEventOn] = useState(false);
  const [eventPre, setEventPre] = useState("");
  const [eventPost, setEventPost] = useState("");
  const generation = useRef(0);
  const eventReady = !eventOn || (!!eventPre && !!eventPost && eventPre < eventPost);

  const canRun = !!aoi && yearA != null && yearB != null && yearA < yearB;

  useEffect(() => {
    generation.current += 1;
    setResult(null);
    setError(null);
  }, [
    aoi,
    yearA,
    yearB,
    startMonth,
    endMonth,
    startDateA,
    endDateA,
    startDateB,
    endDateB,
    mode,
    qMin,
    tauChange,
    cMin,
    scale,
    eventOn,
    eventPre,
    eventPost,
  ]);

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
          ? {
              from_start_date: startDateA,
              from_end_date: endDateA,
              to_start_date: startDateB,
              to_end_date: endDateB,
            }
          : {}),
        fusion_mode: mode,
        q_min: qMin,
        tau_change: tauChange,
        ...(cMin !== "" && Number.isFinite(Number(cMin))
          ? { confidence_threshold: Math.min(1, Math.max(0, Number(cMin))) }
          : {}),
        scale,
        ...(eventOn && eventReady
          ? { event: { type: "flood_sar" as const, pre_date: eventPre, post_date: eventPost } }
          : {}),
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
      case "route":
        return [tiles.route_t0, tiles.route_t1];
      case "quality_optical":
        return [tiles.q_o_t0, tiles.q_o_t1];
      case "quality_sar":
        return [tiles.q_s_t0, tiles.q_s_t1];
      case "landcover":
        return [tiles.landcover_t0, tiles.landcover_t1];
      case "common":
        return [tiles.common_path, tiles.event ?? tiles.changed];
      default:
        return [tiles.change_score, tiles.changed];
    }
  }, [tiles, layer]);

  const legend = useMemo((): {
    entries: MapLegendEntry[];
    scale?: { min: number; max: number; unit: string; colors: string[] };
  } => {
    if (!result) return { entries: [] };
    if (layer === "route" || layer === "common")
      return {
        entries: result.legends.route.map((item) => ({ color: item.color, label: item.label })),
      };
    if (layer === "quality_optical" || layer === "quality_sar") {
      return {
        entries: [],
        scale: { min: 0, max: 1, unit: "", colors: result.legends.quality.palette },
      };
    }
    return {
      entries: result.legends.landcover.map((item) => ({
        color: item.color,
        label: translateLulcClass(item.label),
        value: item.value,
      })),
    };
  }, [result, layer]);

  const nativeZoom = nativeZoomForResolution(Number.parseFloat(result?.resolution ?? "20"));
  const changedFlows = useMemo(
    () => (result?.flows ?? []).filter((flow) => flow.changed).slice(0, 12),
    [result],
  );
  const leftTitle =
    layer === "change"
      ? t("lc.fusion.changeScore")
      : layer === "common"
        ? t("lc.fusion.layer.common")
        : `${t("lc.fusion.periodBase")} (${yearA ?? ""})`;
  const rightTitle =
    layer === "change" || (layer === "common" && !tiles?.event)
      ? t("lc.fusion.validChange")
      : layer === "common"
        ? t("lc.fusion.eventExtent")
        : `${t("lc.fusion.periodCompare")} (${yearB ?? ""})`;

  return (
    <div>
      <section className="card border shadow-sm mb-3" aria-labelledby="lc-fusion-settings-title">
        <div className="card-body p-3 p-lg-4">
          <div className="mb-3">
            <h3 id="lc-fusion-settings-title" className="h6 fw-semibold mb-1">
              {t("lc.fusion.settingsTitle")}
            </h3>
            <p className="small text-muted mb-0">{t("lc.fusion.settingsIntro")}</p>
          </div>
          <div className="row g-3 align-items-end">
            <div className="col-12 col-lg-4">
              <label className="form-label small fw-medium mb-1" htmlFor="fusion-mode">
                {t("lc.fusion.mode")}
              </label>
              <select
                id="fusion-mode"
                className="form-select"
                value={mode}
                onChange={(e) => setMode(e.target.value as LcFusionMode)}
              >
                <option value="routing">{t("lc.fusion.routing")}</option>
                <option value="weighted">{t("lc.fusion.weighted")}</option>
              </select>
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label small fw-medium mb-1" htmlFor="fusion-qmin">
                {t("lc.fusion.qMinLabel")} <var>q</var>
                <sub>min</sub>
              </label>
              <input
                id="fusion-qmin"
                type="number"
                className="form-control"
                min={0}
                max={1}
                step={0.05}
                value={qMin}
                onChange={(e) => setQMin(Math.min(1, Math.max(0, Number(e.target.value))))}
              />
            </div>
            <div className="col-6 col-lg-2">
              <label className="form-label small fw-medium mb-1" htmlFor="fusion-tau">
                {t("lc.fusion.tauLabel")} <var>τ</var>
              </label>
              <input
                id="fusion-tau"
                type="number"
                className="form-control"
                min={0}
                max={1}
                step={0.05}
                value={tauChange}
                onChange={(e) => setTauChange(Math.min(1, Math.max(0, Number(e.target.value))))}
              />
            </div>
            <div className="col-12 col-lg-4">
              <label className="form-label small fw-medium mb-1" htmlFor="fusion-cmin">
                {t("lc.fusion.cMinLabel")} <var>c</var>
                <sub>min</sub> <span className="text-muted">({t("lc.fusion.optional")})</span>
              </label>
              <input
                id="fusion-cmin"
                type="number"
                className="form-control"
                min={0}
                max={1}
                step={0.05}
                placeholder="—"
                value={cMin}
                onChange={(e) => setCMin(e.target.value)}
              />
            </div>
            <div className="col-12 col-lg-3">
              <label className="form-label small fw-medium mb-1" htmlFor="fusion-scale">
                {t("lc.fusion.scale")}
              </label>
              <select
                id="fusion-scale"
                className="form-select"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              >
                <option value={10}>10 m · {t("lc.fusion.scaleDetailed")}</option>
                <option value={20}>20 m · {t("lc.fusion.scaleBalanced")}</option>
                <option value={30}>30 m · {t("lc.fusion.scaleFast")}</option>
              </select>
            </div>
            <div className="col-12 col-lg-6">
              <div className="form-check mb-1">
                <input
                  id="fusion-event"
                  type="checkbox"
                  className="form-check-input"
                  checked={eventOn}
                  onChange={(e) => setEventOn(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="fusion-event">
                  {t("lc.fusion.eventFlood")}
                </label>
              </div>
              {eventOn && (
                <div className="row g-2">
                  <div className="col-6">
                    <input
                      type="date"
                      aria-label={t("lc.fusion.eventPre")}
                      title={t("lc.fusion.eventPre")}
                      className="form-control form-control-sm"
                      value={eventPre}
                      onChange={(e) => setEventPre(e.target.value)}
                    />
                  </div>
                  <div className="col-6">
                    <input
                      type="date"
                      aria-label={t("lc.fusion.eventPost")}
                      title={t("lc.fusion.eventPost")}
                      className="form-control form-control-sm"
                      value={eventPost}
                      onChange={(e) => setEventPost(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="col-12 col-lg-3 ms-lg-auto">
              <button
                className="btn btn-success w-100 fw-semibold py-2"
                disabled={!canRun || running || !eventReady}
                onClick={run}
              >
                {running ? (
                  <>
                    <i className="fas fa-spinner fa-spin me-2" />
                    {t("lc.fusion.running")}
                  </>
                ) : (
                  <>
                    <i className="fas fa-layer-group me-2" />
                    {t("lc.fusion.run")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <details className="card border shadow-sm mb-3" aria-labelledby="lc-fusion-method-title">
        <summary id="lc-fusion-method-title" className="card-header bg-body fw-semibold py-3">
          {t("lc.fusion.methodTitle")}{" "}
          <span className="text-muted fw-normal small ms-1">· Sentinel-2 + Sentinel-1</span>
        </summary>
        <div className="card-body p-3 p-lg-4">
          <p className="text-muted small mb-3">{t("lc.fusion.methodIntro")}</p>
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div className="h-100 p-3 bg-body border rounded-3">
                <div className="small text-muted mb-2">{t("lc.fusion.qualityOpticalTitle")}</div>
                <div
                  className="font-monospace fw-semibold mb-2"
                  aria-label="Q sub o equals V sub o times open parenthesis one minus C sub o close parenthesis times A sub o"
                >
                  Q<sub>o</sub> = V<sub>o</sub> · (1 − C<sub>o</sub>) · A<sub>o</sub>
                </div>
                <p className="small text-muted mb-0">{t("lc.fusion.qualityOpticalHelp")}</p>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="h-100 p-3 bg-body border rounded-3">
                <div className="small text-muted mb-2">{t("lc.fusion.qualitySarTitle")}</div>
                <div
                  className="font-monospace fw-semibold mb-2"
                  aria-label="Q sub s equals V sub s times S sub s times A sub s"
                >
                  Q<sub>s</sub> = V<sub>s</sub> · S<sub>s</sub> · A<sub>s</sub>
                </div>
                <p className="small text-muted mb-0">{t("lc.fusion.qualitySarHelp")}</p>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="h-100 p-3 bg-body border rounded-3">
                <div className="small text-muted mb-2">{t("lc.fusion.changeRuleTitle")}</div>
                <div
                  className="font-monospace fw-semibold mb-2"
                  aria-label="D equals one half times the sum over k of the absolute difference between P at t zero k and P at t one k"
                >
                  D = <sup>1</sup>&frasl;<sub>2</sub> Σ<sub>k=1</sub>
                  <sup>K</sup> |P<sub>t₀,k</sub> − P<sub>t₁,k</sub>|
                </div>
                <p className="small text-muted mb-0">
                  {t("lc.fusion.changeRuleHelp", { tau: tauChange })}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-top small">
            <div className="fw-semibold mb-1">{t("lc.fusion.commonPathTitle")}</div>
            <p className="text-muted mb-2">{t("lc.fusion.commonPathHelp")}</p>
            <p className="alert alert-info py-2 px-3 mb-0 small">{t("lc.fusion.coverageNote")}</p>
          </div>
        </div>
      </details>

      {!canRun && (
        <div className="alert alert-warning py-2 mb-2" style={{ fontSize: ".82rem" }}>
          {t("lc.fusion.needAoi")}
        </div>
      )}
      {error && (
        <div role="alert" className="alert alert-danger py-2 mb-2" style={{ fontSize: ".82rem" }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <PeriodCard
                title={t("lc.fusion.periodBase")}
                period={result.periods.t0}
                language={language}
                t={t}
              />
            </div>
            <div className="col-md-6">
              <PeriodCard
                title={t("lc.fusion.periodCompare")}
                period={result.periods.t1}
                language={language}
                t={t}
              />
            </div>
          </div>

          <section className="mb-3" aria-labelledby="lc-fusion-summary-title">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h3 id="lc-fusion-summary-title" className="h6 fw-semibold mb-0">
                {t("lc.fusion.summaryTitle")}
              </h3>
              <span className="small text-muted">
                {t("lc.fusion.scale")}: {result.resolution}
              </span>
            </div>
            <div className="row row-cols-2 row-cols-lg-4 g-2">
              {[
                {
                  label: t("lc.fusion.validArea"),
                  value: `${formatNumber(result.statistics.valid_area_ha, language)} ha`,
                  detail: t("lc.fusion.validAreaHelp"),
                  tone: "success",
                },
                {
                  label: t("lc.fusion.validChange"),
                  value: `${formatNumber(result.statistics.changed_area_ha, language)} ha`,
                  detail: t("lc.fusion.changePercent", {
                    percent: result.statistics.changed_percentage.toFixed(2),
                  }),
                  tone: "primary",
                },
                {
                  label: t("lc.fusion.noData"),
                  value: `${formatNumber(result.statistics.no_data_area_ha, language)} ha`,
                  detail: t("lc.fusion.noDataHelp"),
                  tone: "secondary",
                },
                {
                  label: <>D</>,
                  value: result.statistics.mean_change_score.toFixed(3),
                  detail: t("lc.fusion.meanDLabel"),
                  tone: "info",
                },
              ].map((item, index) => (
                <div className="col" key={index}>
                  <div className="card h-100 border shadow-sm">
                    <div className="card-body p-3">
                      <div className="small text-muted mb-1">{item.label}</div>
                      <div className="fs-5 fw-semibold text-nowrap">{item.value}</div>
                      <div className="small text-muted mt-1">{item.detail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <details className="mt-2">
              <summary className="small text-muted">{t("lc.fusion.moreStats")}</summary>
              <div className="d-flex flex-wrap gap-2 pt-2 small">
                <span className="badge bg-body-secondary text-body border">
                  {t("lc.fusion.stable")}:{" "}
                  {formatNumber(result.statistics.stable_area_ha, language)} ha
                </span>
                <span className="badge bg-body-secondary text-body border">
                  {t("lc.fusion.belowTau")}:{" "}
                  {formatNumber(result.statistics.suppressed_change_area_ha, language)} ha
                </span>
              </div>
            </details>
          </section>

          <section className="card border shadow-sm mb-3">
            <div className="card-body p-3">
              <div className="fw-semibold mb-2">{t("lc.fusion.commonPath")}</div>
              <div className="row row-cols-2 row-cols-md-4 g-2 mb-2 small">
                {ROUTE_ORDER.map((route) => (
                  <div className="col" key={route}>
                    <div className="d-flex align-items-center gap-2">
                      <span
                        className="rounded-circle flex-shrink-0"
                        style={{ width: 9, height: 9, background: ROUTE_COLOR[route] }}
                      />
                      <span>
                        {routeLabel(route, t)}{" "}
                        <strong>{(result.common_path.percentage[route] ?? 0).toFixed(1)}%</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="small text-muted mb-0">
                {t("lc.fusion.routeSwitch", {
                  switched: formatNumber(result.statistics.route_switch_area_ha, language),
                  perPeriod: formatNumber(result.statistics.per_period_changed_area_ha, language),
                  common: formatNumber(result.statistics.changed_area_ha, language),
                })}
              </p>
            </div>
          </section>

          {result.event && (
            <div className="border rounded p-2 mb-3" style={{ fontSize: ".8rem" }}>
              <div className="fw-semibold mb-1">
                {t("lc.fusion.eventExtent")}{" "}
                {result.event.pre_date && `(${result.event.pre_date} → ${result.event.post_date})`}
              </div>
              <div className="mb-1">
                {t("lc.fusion.eventStats", {
                  area: formatNumber(result.event.event_area_ha, language),
                  valid: formatNumber(result.event.event_valid_area_ha, language),
                  changed: formatNumber(result.event.changed_in_event_ha, language),
                })}
              </div>
              <div className="row g-2">
                {(["classes_t0", "classes_t1"] as const).map((key) => (
                  <div className="col-md-6" key={key}>
                    <div className="text-muted">
                      {key === "classes_t0"
                        ? t("lc.fusion.periodBase")
                        : t("lc.fusion.periodCompare")}
                    </div>
                    {result.event![key].slice(0, 6).map((row) => (
                      <div key={row.class_code}>
                        <span
                          className="d-inline-block me-1 rounded-1"
                          style={{ width: 10, height: 10, background: row.color }}
                        />
                        {translateLulcClass(row.class)}: {formatNumber(row.area_ha, language)} ha
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="text-muted mt-1">{result.event.note}</div>
            </div>
          )}

          <div className="d-flex align-items-center gap-2 mb-2">
            <label className="small mb-0" htmlFor="fusion-layer">
              {t("lc.fusion.mapLayer")}
            </label>
            <select
              id="fusion-layer"
              className="form-select form-select-sm"
              style={{ maxWidth: 320 }}
              value={layer}
              onChange={(e) => setLayer(e.target.value as LayerKind)}
            >
              {LAYERS.map((item) => (
                <option key={item.kind} value={item.kind}>
                  {t(item.translationKey)}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="row g-2">
        {[
          { id: "lcFusionMapT0", tile: leftTile, title: leftTitle },
          { id: "lcFusionMapT1", tile: rightTile, title: rightTitle },
        ].map((panel) => (
          <div className="col-md-6" key={panel.id}>
            <MapView id={panel.id} showGlobeControl={false}>
              <MapCursorPosition />
              <BasemapSwitcher />
              <LayerOpacityControl
                opacity={opacity}
                onChange={setOpacity}
                label={t("lc.mapOpacity")}
              />
              {aoi && (
                <GeoJSON
                  key={JSON.stringify(aoi.geometry)}
                  data={aoi as GeoJSON.Feature}
                  style={AOI_STYLE}
                />
              )}
              {panel.tile && (
                <TileLayer
                  key={panel.tile}
                  url={panel.tile}
                  maxNativeZoom={nativeZoom}
                  maxZoom={HIGH_DETAIL_MAX_ZOOM}
                  opacity={opacity}
                  attribution="Google Earth Engine"
                  pane={RESULT_PANE}
                />
              )}
              <FitToAoi aoi={aoi} />
            </MapView>
            {result &&
              (layer === "change" && panel.id === "lcFusionMapT0" ? (
                <MapLegend
                  title={panel.title}
                  entries={[]}
                  scale={{ min: 0, max: 1, unit: "", colors: ["#f8fafc", "#fde047", "#dc2626"] }}
                />
              ) : (
                <MapLegend title={panel.title} entries={legend.entries} scale={legend.scale} />
              ))}
          </div>
        ))}
      </div>

      {result && (
        <div className="row g-3 mt-1">
          <div className="col-lg-7">
            <div className="fw-semibold mb-1" style={{ fontSize: ".85rem" }}>
              {t("lc.fusion.topTransitions")}
            </div>
            <div className="table-responsive" style={{ maxHeight: 300, overflowY: "auto" }}>
              <table className="table table-sm mb-0" style={{ fontSize: ".78rem" }}>
                <thead className="table-primary sticky-top">
                  <tr>
                    <th>{t("lc.fusion.from")}</th>
                    <th>{t("lc.fusion.to")}</th>
                    <th className="text-end">{t("lc.fusion.areaHa")}</th>
                  </tr>
                </thead>
                <tbody>
                  {changedFlows.map((flow) => (
                    <tr key={`${flow.from_class}-${flow.to_class}`}>
                      <td>
                        <span
                          className="d-inline-block me-1 rounded-1"
                          style={{ width: 10, height: 10, background: flow.from_color }}
                        />
                        {translateLulcClass(flow.from)}
                      </td>
                      <td>
                        <span
                          className="d-inline-block me-1 rounded-1"
                          style={{ width: 10, height: 10, background: flow.to_color }}
                        />
                        {translateLulcClass(flow.to)}
                      </td>
                      <td className="text-end">{formatNumber(flow.area, language)}</td>
                    </tr>
                  ))}
                  {!changedFlows.length && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted">
                        {t("lc.fusion.noTransitions")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="col-lg-5" style={{ fontSize: ".78rem" }}>
            <div className="fw-semibold mb-1" style={{ fontSize: ".85rem" }}>
              {t("lc.fusion.provenance")}
            </div>
            <ul className="mb-2 ps-3">
              <li>
                {t("lc.fusion.method", {
                  method: result.method,
                  mode: result.fusion_mode,
                  qMin: result.parameters.q_min,
                  tau: result.parameters.tau_change,
                })}
              </li>
              <li>
                {t("lc.fusion.grid", { resolution: result.resolution, crs: result.comparison_crs })}
              </li>
              {result.training.training_sample_count != null && (
                <li>
                  {t("lc.fusion.trainingSamples", { count: result.training.training_sample_count })}
                </li>
              )}
              {result.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
