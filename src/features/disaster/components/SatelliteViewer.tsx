import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, Pane, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { nativeZoomForResolution } from "@/config/mapZoom";
import RasterResolutionNotice from "@/components/map/RasterResolutionNotice";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import { HistoricalAoiClipController } from "@/components/map/HistoricalImageryControl";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import { env } from "@/config/env";
import { useI18nStore } from "@/hooks/useI18nStore";
import { getImagerySceneTile, listImageryScenes } from "@/features/imagery/api";
import {
  ESRI_WAYBACK_START_DATE,
  listEsriWaybackScenes,
  selectEsriWaybackScene,
  type WaybackScene,
} from "@/features/imagery/wayback";
import type { AoiFeature } from "@/types/map";
import { SegmentationStatistics, SegmentationSummary, type SegmentationResult } from "./SegmentationComparison";
import type {
  DisasterAoiRecord,
  DisasterAnalysisEntry,
  DisasterEventRecord,
  DisasterImageryGroup,
  DisasterPrimaryImagery,
  DisasterSatelliteLayers,
  HotspotRecord,
  SatelliteImageryRecord,
  FirmsHotspotFeature,
} from "../types";

type ViewMode = "pre" | "post" | "split" | "swipe";
type OutputMode = "imagery" | "classes" | "change";
interface ViewerViewport {
  geometry: GeoJSON.GeoJsonObject | null;
  center: L.LatLng;
  zoom: number;
}
interface ViewerComparison {
  model_id: string;
  user_label: string;
  runId?: number;
  comparison: SegmentationResult;
}
const DISASTER_SCENE_MAX_ZOOM = 23;
const DISASTER_FIT_MAX_ZOOM = 18;

const AOI_STYLE = { color: "#1565c0", weight: 2, fill: false };
const HOTSPOT_STYLE = { color: "#e53935", weight: 2, fillOpacity: 0.25 };
const HOTSPOT_HIGHLIGHT_STYLE = { color: "#ffb300", weight: 4, fillOpacity: 0.35 };
const DISASTER_ANALYSIS_PANE = "disaster-analysis-pane";
const DISASTER_ANALYSIS_PANE_Z_INDEX = 370;
const DISASTER_IMAGERY_PANE = "disaster-imagery-pane";
const DISASTER_IMAGERY_PANE_Z_INDEX = 350;

type DynamicImagerySource = "sentinel2" | "esri_wayback";

interface DynamicImageryLayer {
  source: DynamicImagerySource;
  label: string;
  tileUrl: string;
  acquisitionDate: string;
  resolutionM: number | null;
  attribution: string;
}

function aoiFeatureOf(aoi: DisasterAoiRecord | null): AoiFeature | null {
  const geojson = aoi?.geojson;
  if (!geojson) return null;
  const geometry = geojson.type === "Feature" ? geojson.geometry : geojson;
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return null;
  if (geojson.type === "Feature") return geojson as AoiFeature;
  return { type: "Feature", properties: {}, geometry } as AoiFeature;
}

function aoiBoundsOf(aoi: DisasterAoiRecord | null): [[number, number], [number, number]] | undefined {
  if (aoi?.bbox && aoi.bbox.length === 4) {
    const [west, south, east, north] = aoi.bbox;
    return [[south, west], [north, east]];
  }
  const feature = aoiFeatureOf(aoi);
  if (!feature) return undefined;
  const bounds = L.geoJSON(feature).getBounds();
  return bounds.isValid()
    ? [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]]
    : undefined;
}

function dateOnly(value: string | null | undefined): string | null {
  const match = value?.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

function shiftIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Search a bounded period immediately before the event for a dynamic pre image. */
function preDateRange(event?: DisasterEventRecord): { startDate: string; endDate: string } {
  const anchor = dateOnly(event?.start_date) ?? dateOnly(event?.event_date) ?? dateOnly(event?.end_date) ?? todayIso();
  const endDate = shiftIsoDate(anchor, -1);
  return { startDate: shiftIsoDate(endDate, -365), endDate };
}

function postDateRange(event?: DisasterEventRecord): { startDate: string; endDate: string } {
  const endDate = todayIso();
  const startDate = dateOnly(event?.end_date) ?? dateOnly(event?.event_date) ?? dateOnly(event?.start_date);
  return { startDate: startDate && startDate <= endDate ? startDate : endDate, endDate };
}

function FitToAoi({
  geometry,
  maps,
  viewport,
  maxZoom = DISASTER_FIT_MAX_ZOOM,
}: {
  geometry: GeoJSON.GeoJsonObject | null;
  maps: React.MutableRefObject<Set<L.Map>>;
  viewport: React.MutableRefObject<ViewerViewport | null>;
  maxZoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    const registered = maps.current;
    if (viewport.current?.geometry === geometry) {
      map.setView(viewport.current.center, viewport.current.zoom, { animate: false });
    } else if (geometry) {
      const bounds = L.geoJSON(geometry as GeoJSON.Feature).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom });
    }
    registered.add(map);
    const sync = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      viewport.current = { geometry, center, zoom };
      map.getContainer().dataset.mapCenter = JSON.stringify([center.lat, center.lng]);
      map.getContainer().dataset.mapZoom = String(zoom);
      for (const other of registered) {
        if (other !== map && (!other.getCenter().equals(center) || other.getZoom() !== zoom)) {
          other.setView(center, zoom, { animate: false });
        }
      }
    };
    sync();
    map.on("moveend", sync);
    return () => { map.off("moveend", sync); registered.delete(map); };
  }, [geometry, map, maps, maxZoom, viewport]);
  return null;
}

function FitToFeature({
  feature,
  signal,
  maxZoom = DISASTER_FIT_MAX_ZOOM,
}: {
  feature: GeoJSON.Feature | GeoJSON.Geometry | GeoJSON.FeatureCollection | null;
  signal: number;
  maxZoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!feature) return;
    const geom = feature.type === "Feature" || feature.type === "FeatureCollection"
      ? feature
      : { type: "Feature" as const, properties: {}, geometry: feature };
    const bounds = L.geoJSON(geom as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
  return null;
}

function imageryLabel(img: SatelliteImageryRecord): string {
  return `${img.satellite} · ${img.acquisition_date}`;
}

function viewerTileUrl(img: SatelliteImageryRecord | null): string | null {
  const url = img?.preview_tile_url ?? null;
  if (!url) return null;
  const absolute = url.startsWith("/")
    ? `${env.apiBaseUrl.replace(/\/api\/?$/, "")}${url}`
    : url;
  return absolute;
}

function viewerUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/")
    ? `${env.apiBaseUrl.replace(/\/api\/?$/, "")}${url}`
    : url;
}

interface DynamicImageryRequest {
  source: DynamicImagerySource;
  phase: "pre" | "post";
  aoi: AoiFeature;
  range: { startDate: string; endDate: string };
  targetDate: string;
}

async function loadDynamicImagery({ source, phase, aoi, range, targetDate }: DynamicImageryRequest): Promise<DynamicImageryLayer> {
  const phaseLabel = phase === "pre" ? "pra-bencana" : "pasca-bencana";
  if (source === "sentinel2") {
    const scenes = await listImageryScenes({
      aoi: { geojson: aoi },
      satellite: "sentinel2",
      startDate: range.startDate,
      endDate: range.endDate,
      maxCloudCover: 60,
    });
    const scene = scenes.scenes
      .slice()
      .sort((left, right) => right.acquired_at.localeCompare(left.acquired_at))[0];
    if (!scene) throw new Error(`Scene Sentinel-2 ${phaseLabel} tidak ditemukan pada periode ini.`);

    const tile = await getImagerySceneTile({
      satellite: "sentinel2",
      sceneId: scene.id,
      aoi: { geojson: aoi },
      forceMosaic: true,
      startDate: range.startDate,
      endDate: range.endDate,
      maxCloudCover: 60,
      cloudMaskTechnique: "scl",
    });
    if (!tile.tile_url) throw new Error("Tile Sentinel-2 tidak tersedia.");
    return {
      source,
      label: `Sentinel-2 - ${dateOnly(scene.acquired_at) ?? scene.acquired_at}`,
      tileUrl: viewerUrl(tile.tile_url) ?? tile.tile_url,
      acquisitionDate: dateOnly(scene.acquired_at) ?? scene.acquired_at,
      resolutionM: tile.satellite?.resolution_m ?? scene.resolution_m ?? 10,
      attribution: "Sentinel-2 - Google Earth Engine",
    };
  }

  const scenes = await listEsriWaybackScenes(ESRI_WAYBACK_START_DATE, range.endDate, 2000);
  const scene = selectEsriWaybackScene(scenes as WaybackScene[], targetDate);
  if (!scene) throw new Error(`Snapshot Esri Wayback ${phaseLabel} tidak ditemukan.`);
  return {
    source,
    label: `Esri Wayback - ${scene.release_label}`,
    tileUrl: scene.tile_url,
    acquisitionDate: scene.release_label,
    resolutionM: null,
    attribution: `Esri World Imagery Wayback - Rilis ${scene.release_label}`,
  };
}

function historicalDateForSource(source: DynamicImagerySource | null, date: string | null): string | undefined {
  return source === "esri_wayback" ? undefined : date ?? undefined;
}

function ViewerLayerPane() {
  const map = useMap();
  useEffect(() => {
    const pane = map.getPane(DISASTER_ANALYSIS_PANE) ?? map.createPane(DISASTER_ANALYSIS_PANE);
    pane.style.zIndex = String(DISASTER_ANALYSIS_PANE_Z_INDEX);
    pane.style.pointerEvents = "none";
  }, [map]);
  return null;
}

function firmsColor(label: string | null): string {
  return label === "high" ? "#ef4444" : label === "nominal" ? "#f97316" : "#facc15";
}

interface DisplayFirmsHotspot {
  key: string;
  latitude: number;
  longitude: number;
  count: number;
  feature: FirmsHotspotFeature;
}

function FirmsHotspotLayer({ features, showLabels, cluster }: { features: FirmsHotspotFeature[]; showLabels: boolean; cluster: boolean }) {
  const displayed = useMemo<DisplayFirmsHotspot[]>(() => {
    if (!cluster) return features.map((feature) => ({ key: String(feature.id), latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0], count: 1, feature }));
    const groups = new Map<string, DisplayFirmsHotspot>();
    for (const feature of features) {
      const [longitude, latitude] = feature.geometry.coordinates;
      const key = `${Math.round(longitude * 20) / 20}:${Math.round(latitude * 20) / 20}`;
      const existing = groups.get(key);
      if (existing) existing.count += 1;
      else groups.set(key, { key, latitude, longitude, count: 1, feature });
    }
    return [...groups.values()];
  }, [cluster, features]);
  const t = useI18nStore((state) => state.t);
  return (
    <>
      {displayed.map((item) => {
        const properties = item.feature.properties;
        const radius = item.count > 1 ? Math.min(18, 6 + Math.log2(item.count) * 3) : Math.min(13, 5 + Math.sqrt(Math.max(0, properties.frp ?? 0)) / 3);
        const color = firmsColor(properties.confidence_label);
        return (
          <CircleMarker key={`firms-${item.key}`} center={[item.latitude, item.longitude]} radius={radius} pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 1.5 }}>
            {showLabels && <Tooltip permanent direction="top" offset={[0, -radius]}>{item.count > 1 ? `${item.count} ${t("disaster.firms.detections")}` : properties.source_label}</Tooltip>}
            <Popup>
              <div className="firms-popup">
                <strong>{item.count > 1 ? `${item.count} ${t("disaster.firms.detections")}` : t("disaster.firms.title")}</strong>
                {item.count === 1 ? (
                  <dl className="small mb-0 mt-2">
                    <dt>{t("disaster.firms.acquisition")}</dt><dd>{properties.acq_datetime_utc ?? "-"}</dd>
                    <dt>{t("disaster.firms.satellite")}</dt><dd>{properties.satellite ?? "-"} / {properties.instrument ?? "-"}</dd>
                    <dt>{t("disaster.firms.confidence")}</dt><dd>{properties.confidence ?? "-"} ({properties.confidence_label ?? "-"})</dd>
                    <dt>FRP</dt><dd>{properties.frp ?? "-"} MW</dd>
                    <dt>{t("disaster.firms.brightness")}</dt><dd>{properties.bright_ti4 ?? "-"} / {properties.bright_ti5 ?? "-"} K</dd>
                    <dt>{t("disaster.firms.dayNight")}</dt><dd>{properties.daynight ?? "-"}</dd>
                    <dt>{t("disaster.firms.coordinates")}</dt><dd>{properties.latitude.toFixed(5)}, {properties.longitude.toFixed(5)}</dd>
                    <dt>{t("disaster.firms.source")}</dt><dd>{properties.source}</dd>
                  </dl>
                ) : <div className="small mt-2">{t("disaster.firms.clusterPopup")}</div>}
                <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer" className="small">{t("disaster.firms.attribution")}</a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

interface ViewerLayersProps {
  aoi: DisasterAoiRecord | null;
  showAoi: boolean;
  satellite: DisasterSatelliteLayers | null;
  showSatellite: boolean;
  analyses: DisasterAnalysisEntry[];
  checkedAnalyses: Set<string>;
  hotspots: HotspotRecord[];
  showHotspots: boolean;
  highlightedHotspotId: number | null;
  onHotspotClick?: (hotspotId: number) => void;
  firmsFeatures: FirmsHotspotFeature[];
  firmsShowLabels: boolean;
  firmsCluster: boolean;
}

function ViewerLayers({
  aoi,
  showAoi,
  satellite,
  showSatellite,
  analyses,
  checkedAnalyses,
  hotspots,
  showHotspots,
  highlightedHotspotId,
  onHotspotClick,
  firmsFeatures,
  firmsShowLabels,
  firmsCluster,
}: ViewerLayersProps) {
  return (
    <>
      <ViewerLayerPane />
      {showSatellite && (satellite?.post_tile_url || satellite?.pre_tile_url) && (
        <TileLayer
          url={viewerUrl(satellite.post_tile_url ?? satellite.pre_tile_url)!}
          opacity={0.35}
          attribution="Citra satelit referensi"
          pane={DISASTER_ANALYSIS_PANE}
        />
      )}
      {analyses
        .filter((entry) => checkedAnalyses.has(entry.model_id) && !entry.result?.comparison && entry.result?.tile_url)
        .map((entry) => (
          <TileLayer
            key={`analysis-${entry.model_id}`}
            url={viewerUrl(entry.result!.tile_url)!}
            opacity={0.82}
            attribution={entry.user_label}
            pane={DISASTER_ANALYSIS_PANE}
          />
        ))}
      {analyses
        .filter((entry) => checkedAnalyses.has(entry.model_id) && entry.result?.features?.features?.length)
        .map((entry) => (
          <GeoJSON
            key={`analysis-features-${entry.model_id}`}
            data={entry.result!.features!}
            style={{ color: entry.result_semantics === "candidate_object" ? "#7c3aed" : "#f97316", weight: 2, fillOpacity: 0.22 }}
          />
        ))}
      {showAoi && aoi?.geojson && (
        <GeoJSON
          key={`aoi-${aoi.id}`}
          data={aoi.geojson as GeoJSON.Feature}
          style={AOI_STYLE}
        />
      )}
      <FirmsHotspotLayer features={firmsFeatures} showLabels={firmsShowLabels} cluster={firmsCluster} />
      {showHotspots &&
        hotspots.map((hotspot) => (
          <GeoJSON
            key={`hotspot-${hotspot.id}`}
            data={hotspot.geojson as GeoJSON.Feature}
            style={
              hotspot.id === highlightedHotspotId ? HOTSPOT_HIGHLIGHT_STYLE : HOTSPOT_STYLE
            }
            eventHandlers={
              onHotspotClick ? { click: () => onHotspotClick(hotspot.id) } : undefined
            }
          />
        ))}
    </>
  );
}

interface Props {
  event?: DisasterEventRecord;
  aoi: DisasterAoiRecord | null;
  imagery: DisasterImageryGroup;
  primaryImagery: DisasterPrimaryImagery;
  satellite?: DisasterSatelliteLayers | null;
  showSatellite?: boolean;
  analyses?: DisasterAnalysisEntry[];
  checkedAnalyses?: Set<string>;
  showAoi?: boolean;
  hotspots?: HotspotRecord[];
  showHotspots?: boolean;
  highlightedHotspotId?: number | null;
  onHotspotClick?: (hotspotId: number) => void;
  firmsFeatures?: FirmsHotspotFeature[];
  firmsShowLabels?: boolean;
  firmsCluster?: boolean;
  focusFeature?: GeoJSON.Feature | GeoJSON.Geometry | GeoJSON.FeatureCollection | null;
  focusSignal?: number;
  showGlobeControl?: boolean;
  initialOutput?: OutputMode;
  comparisonResults?: ViewerComparison[];
}

/**
 * Item 2 of the redesign spec (D.2): before/after raw satellite comparison.
 * Reuses `SwipeCompareMap` directly for the Swipe mode, and reimplements
 * `lc-change/components/BeforeAfterMaps.tsx`'s split-view toggle pattern
 * (two independent `MapView`s) for Side-by-Side; Pre/Post-only render a
 * single `MapView` with one tile layer. Saved imagery remains selectable from
 * the event record, while AOI-backed Sentinel-2 and Esri Wayback sources are
 * available as dynamic alternatives.
 */
export default function SatelliteViewer({
  event,
  aoi,
  imagery,
  primaryImagery,
  satellite = null,
  showSatellite = false,
  analyses = [],
  checkedAnalyses = new Set<string>(),
  showAoi = true,
  hotspots = [],
  showHotspots = true,
  highlightedHotspotId = null,
  onHotspotClick,
  firmsFeatures = [],
  firmsShowLabels = false,
  firmsCluster = true,
  focusFeature = null,
  focusSignal = 0,
  showGlobeControl = true,
  initialOutput = "imagery",
  comparisonResults,
}: Props) {
  const { language } = useI18nStore();
  const [preId, setPreId] = useState<number | null>(
    primaryImagery.pre?.id ?? imagery.pre[0]?.id ?? null,
  );
  const [postId, setPostId] = useState<number | null>(
    primaryImagery.post?.id ?? imagery.post[0]?.id ?? null,
  );
  const [view, setView] = useState<ViewMode>("swipe");
  const [swipeOrientation, setSwipeOrientation] = useState<SwipeOrientation>("vertical");
  const [imageryOpacity, setImageryOpacity] = useState(0.9);
  const [analysisOpacity, setAnalysisOpacity] = useState(1);
  const [output, setOutput] = useState<OutputMode>(initialOutput);
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [tileErrorSource, setTileErrorSource] = useState<string | null>(null);
  const maps = useRef(new Set<L.Map>());
  const viewport = useRef<ViewerViewport | null>(null);
  const [preSource, setPreSource] = useState<DynamicImagerySource | null>(null);
  const [dynamicPre, setDynamicPre] = useState<DynamicImageryLayer | null>(null);
  const [dynamicPreLoading, setDynamicPreLoading] = useState(false);
  const [dynamicPreError, setDynamicPreError] = useState<string | null>(null);
  const [postSource, setPostSource] = useState<DynamicImagerySource | null>(null);
  const [dynamicPost, setDynamicPost] = useState<DynamicImageryLayer | null>(null);
  const [dynamicPostLoading, setDynamicPostLoading] = useState(false);
  const [dynamicPostError, setDynamicPostError] = useState<string | null>(null);

  const aoiFeature = useMemo(() => aoiFeatureOf(aoi), [aoi]);
  const aoiBounds = useMemo(() => aoiBoundsOf(aoi), [aoi]);

  const preImg = useMemo(
    () => (preSource ? null : imagery.pre.find((i) => i.id === preId) ?? null),
    [imagery.pre, preId, preSource],
  );
  const postImg = useMemo(
    () => (postSource ? null : imagery.post.find((i) => i.id === postId) ?? null),
    [imagery.post, postId, postSource],
  );
  const preRange = useMemo(() => preDateRange(event), [event]);
  const postRange = useMemo(() => postDateRange(event), [event]);
  const preTile = dynamicPre?.tileUrl ?? viewerTileUrl(preImg);
  const preDate = dynamicPre?.acquisitionDate ?? preImg?.acquisition_date ?? null;
  const preResolutionM = dynamicPre?.resolutionM ?? preImg?.resolution_m ?? null;
  const preAttribution = dynamicPre?.attribution ?? "Google Earth Engine";
  const postTile = dynamicPost?.tileUrl ?? viewerTileUrl(postImg);
  const postDate = dynamicPost?.acquisitionDate ?? postImg?.acquisition_date ?? null;
  const postResolutionM = dynamicPost?.resolutionM ?? postImg?.resolution_m ?? null;
  const postAttribution = dynamicPost?.attribution ?? "Google Earth Engine";
  const preSelection = preSource ? `source:${preSource}` : preId ? String(preId) : "";
  const postSelection = postSource ? `source:${postSource}` : postId ? String(postId) : "";
  const comparisonEntries = comparisonResults ?? analyses.flatMap(entry =>
    entry.available && checkedAnalyses.has(entry.model_id) && entry.result?.comparison
      ? [{ model_id: entry.model_id, user_label: entry.user_label, runId: entry.run?.id, comparison: entry.result.comparison }]
      : []);
  const comparisonEntry = comparisonEntries.find(entry => entry.model_id === comparisonId) ?? comparisonEntries[0];
  const comparison = comparisonEntry?.comparison ?? null;
  const hasClassTiles = !!(comparison?.pre_tile_url || comparison?.post_tile_url);
  const activeOutput: OutputMode = !comparison ? "imagery"
    : output === "change" && !comparison.change_tile_url ? hasClassTiles ? "classes" : "imagery"
    : output === "classes" && !hasClassTiles ? "imagery" : output;
  const displayView = activeOutput === "change" ? "post" : view;
  const analysisVisible = activeOutput !== "imagery";
  const opacity = analysisVisible ? analysisOpacity : imageryOpacity;
  const setOpacity = analysisVisible ? setAnalysisOpacity : setImageryOpacity;
  const opacityLabel = language === "id"
    ? analysisVisible ? "Opasitas segmentasi" : "Opasitas citra"
    : analysisVisible ? "Segmentation opacity" : "Imagery opacity";
  const comparisonFeature = useMemo<AoiFeature | null>(() => comparison
    ? { type: "Feature", properties: {}, geometry: comparison.aoi }
    : null, [comparison]);
  const displayAoi = analysisVisible ? comparisonFeature : aoiFeature;
  const fitGeometry = aoi?.geojson ?? comparisonFeature;
  const displayBounds = useMemo(() => analysisVisible && comparisonFeature
    ? L.geoJSON(comparisonFeature).getBounds()
    : aoiBounds, [analysisVisible, comparisonFeature, aoiBounds]);
  const displayPreTile = analysisVisible ? viewerUrl(comparison?.pre_tile_url ?? null) : preTile;
  const displayPostTile = analysisVisible ? viewerUrl(activeOutput === "change" ? comparison?.change_tile_url ?? null : comparison?.post_tile_url ?? null) : postTile;
  const displayPreDate = analysisVisible ? comparison?.pre.date ?? null : preDate;
  const displayPostDate = analysisVisible ? comparison?.post.date ?? null : postDate;
  const displayPreResolution = analysisVisible ? comparison?.resolution_m ?? null : preResolutionM;
  const displayPostResolution = analysisVisible ? comparison?.resolution_m ?? null : postResolutionM;
  const displayPreNativeZoom = nativeZoomForResolution(displayPreResolution);
  const displayPostNativeZoom = nativeZoomForResolution(displayPostResolution);
  const analysisAttribution = comparison?.model_id === "dynamic_world_v1" ? "Dynamic World · Google Earth Engine" : comparisonEntry?.user_label ?? "";
  const displayPreAttribution = analysisVisible ? analysisAttribution : preAttribution;
  const displayPostAttribution = analysisVisible ? analysisAttribution : postAttribution;
  const preLabel = `${analysisVisible ? "Segmentasi pre" : language === "id" ? "Sebelum" : "Before"}${displayPreDate ? ` · ${displayPreDate}` : ""}`;
  const postLabel = `${activeOutput === "change" ? language === "id" ? "Perubahan" : "Change" : analysisVisible ? "Segmentasi post" : language === "id" ? "Sesudah" : "After"}${displayPostDate ? ` · ${displayPostDate}` : ""}`;
  const tileErrorKey = `${comparisonEntry?.model_id}-${comparisonEntry?.runId}-${activeOutput}-${displayView}-${displayPreTile}-${displayPostTile}`;
  const chooseView = (next: ViewMode) => {
    setView(next);
    if (activeOutput === "change") setOutput("classes");
  };

  useEffect(() => {
    let cancelled = false;
    if (!preSource) {
      setDynamicPre(null);
      setDynamicPreLoading(false);
      setDynamicPreError(null);
      return;
    }
    if (!aoiFeature) {
      setDynamicPre(null);
      setDynamicPreLoading(false);
      setDynamicPreError("AOI tidak valid untuk memuat citra pra-bencana.");
      return;
    }

    setDynamicPre(null);
    setDynamicPreLoading(true);
    setDynamicPreError(null);
    const targetDate = preRange.endDate;

    void loadDynamicImagery({
      source: preSource,
      phase: "pre",
      aoi: aoiFeature,
      range: preRange,
      targetDate,
    })
      .then((layer) => {
        if (!cancelled) setDynamicPre(layer);
      })
      .catch((error: unknown) => {
        if (!cancelled) setDynamicPreError(error instanceof Error ? error.message : "Gagal memuat citra pra-bencana.");
      })
      .finally(() => {
        if (!cancelled) setDynamicPreLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [aoiFeature, preRange, preSource]);

  useEffect(() => {
    let cancelled = false;
    if (!postSource) {
      setDynamicPost(null);
      setDynamicPostLoading(false);
      setDynamicPostError(null);
      return;
    }
    if (!aoiFeature) {
      setDynamicPost(null);
      setDynamicPostLoading(false);
      setDynamicPostError("AOI tidak valid untuk memuat citra pasca-bencana.");
      return;
    }

    setDynamicPost(null);
    setDynamicPostLoading(true);
    setDynamicPostError(null);

    const loadDynamicPost = async () => {
      try {
        if (postSource === "sentinel2") {
          const scenes = await listImageryScenes({
            aoi: { geojson: aoiFeature },
            satellite: "sentinel2",
            startDate: postRange.startDate,
            endDate: postRange.endDate,
            maxCloudCover: 60,
          });
          const scene = scenes.scenes
            .slice()
            .sort((left, right) => right.acquired_at.localeCompare(left.acquired_at))[0];
          if (!scene) throw new Error("Scene Sentinel-2 pasca-bencana tidak ditemukan pada rentang ini.");

          const tile = await getImagerySceneTile({
            satellite: "sentinel2",
            sceneId: scene.id,
            aoi: { geojson: aoiFeature },
            forceMosaic: true,
            startDate: postRange.startDate,
            endDate: postRange.endDate,
            maxCloudCover: 60,
            cloudMaskTechnique: "scl",
          });
          if (!tile.tile_url) throw new Error("Tile Sentinel-2 tidak tersedia.");
          if (!cancelled) {
            setDynamicPost({
              source: postSource,
              label: `Sentinel-2 · ${dateOnly(scene.acquired_at) ?? scene.acquired_at}`,
              tileUrl: viewerUrl(tile.tile_url) ?? tile.tile_url,
              acquisitionDate: dateOnly(scene.acquired_at) ?? scene.acquired_at,
              resolutionM: tile.satellite?.resolution_m ?? scene.resolution_m ?? 10,
              attribution: "Sentinel-2 · Google Earth Engine",
            });
          }
        } else {
          const scenes = await listEsriWaybackScenes(ESRI_WAYBACK_START_DATE, postRange.endDate, 2000);
          const targetDate = dateOnly(event?.end_date) ?? dateOnly(event?.event_date) ?? postRange.endDate;
          const scene = selectEsriWaybackScene(scenes as WaybackScene[], targetDate);
          if (!scene) throw new Error("Snapshot Esri Wayback pasca-bencana tidak ditemukan.");
          if (!cancelled) {
            setDynamicPost({
              source: postSource,
              label: `Esri Wayback · ${scene.release_label}`,
              tileUrl: scene.tile_url,
              acquisitionDate: scene.release_label,
              resolutionM: null,
              attribution: `Esri World Imagery Wayback · Rilis ${scene.release_label}`,
            });
          }
        }
      } catch (error) {
        if (!cancelled) setDynamicPostError(error instanceof Error ? error.message : "Gagal memuat citra pasca-bencana.");
      } finally {
        if (!cancelled) setDynamicPostLoading(false);
      }
    };

    void loadDynamicPost();
    return () => {
      cancelled = true;
    };
  }, [aoiFeature, event?.end_date, event?.event_date, postRange, postSource]);

  const sharedLayers = <>
    <ViewerLayers aoi={aoi} showAoi={showAoi} satellite={satellite} showSatellite={showSatellite}
      analyses={analyses} checkedAnalyses={checkedAnalyses} hotspots={hotspots} showHotspots={showHotspots}
      highlightedHotspotId={highlightedHotspotId} onHotspotClick={onHotspotClick}
      firmsFeatures={firmsFeatures} firmsShowLabels={firmsShowLabels} firmsCluster={firmsCluster} />
    {showAoi && !aoi?.geojson && comparisonFeature && <GeoJSON data={comparisonFeature} style={AOI_STYLE} />}
    <FitToAoi geometry={fitGeometry} maps={maps} viewport={viewport} />
    <FitToFeature feature={focusFeature} signal={focusSignal} />
  </>;
  const historicalDate = (phase: "pre" | "post") => analysisVisible
    ? (phase === "pre" ? displayPreDate : displayPostDate) ?? undefined
    : historicalDateForSource(phase === "pre" ? preSource : postSource, phase === "pre" ? preDate : postDate);
  const renderMap = (phase: "pre" | "post", globeControl: boolean) => {
    const tile = phase === "pre" ? displayPreTile : displayPostTile;
    const resolutionM = phase === "pre" ? displayPreResolution : displayPostResolution;
    const nativeZoom = phase === "pre" ? displayPreNativeZoom : displayPostNativeZoom;
    const image = phase === "pre" ? preImg : postImg;
    return <MapView id={`disasterSatMap-${phase}`} showGlobeControl={globeControl} historicalDate={historicalDate(phase)}>
      <BasemapSwitcher />
      <Pane name={DISASTER_IMAGERY_PANE} style={{ zIndex: DISASTER_IMAGERY_PANE_Z_INDEX, pointerEvents: "none" }} />
      <HistoricalAoiClipController aoi={displayAoi} paneName={DISASTER_IMAGERY_PANE} />
      <LayerOpacityControl opacity={opacity} onChange={setOpacity} label={opacityLabel} />
      {tile && <TileLayer key={tile} url={tile} opacity={opacity}
        attribution={phase === "pre" ? displayPreAttribution : displayPostAttribution}
        crossOrigin={!analysisVisible && image?.source_kind === "local_upload" ? "use-credentials" : undefined}
        pane={DISASTER_IMAGERY_PANE} bounds={displayBounds} maxNativeZoom={nativeZoom} maxZoom={DISASTER_SCENE_MAX_ZOOM}
        eventHandlers={{ tileerror: () => setTileErrorSource(tileErrorKey) }} />}
      {sharedLayers}
      <RasterResolutionNotice layers={[{ label: phase === "pre" ? preLabel : postLabel, resolutionM, nativeZoom }]} />
    </MapView>;
  };

  if (!imagery.pre.length && !imagery.post.length && !aoiFeature && !comparison) {
    return (
      <div className="alert alert-secondary py-2 mb-3">
        Belum ada citra satelit pre/post untuk event ini.
      </div>
    );
  }

  return (
    <div className="card mb-3 pb-4 disaster-modern-card disaster-satellite-card">
      <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap disaster-soft-header">
        <span className="fw-semibold disaster-panel-title">
          <i className="bi bi-images" /> {language === "id" ? "Citra Satelit" : "Satellite Imagery"}
        </span>
        <div
          className="btn-group btn-group-sm ms-auto disaster-view-toggle"
          role="group"
          aria-label={language === "id" ? "Tampilan citra" : "Imagery view"}
        >
          <button
            type="button"
            className={`btn btn-outline-secondary ${activeOutput !== "change" && displayView === "pre" ? "active" : ""}`}
            aria-pressed={activeOutput !== "change" && displayView === "pre"}
            onClick={() => chooseView("pre")}
          >
            Pre
          </button>
          <button
            type="button"
            className={`btn btn-outline-secondary ${activeOutput !== "change" && displayView === "post" ? "active" : ""}`}
            aria-pressed={activeOutput !== "change" && displayView === "post"}
            onClick={() => chooseView("post")}
          >
            Post
          </button>
          <button
            type="button"
            className={`btn btn-outline-secondary ${activeOutput !== "change" && displayView === "split" ? "active" : ""}`}
            aria-pressed={activeOutput !== "change" && displayView === "split"}
            onClick={() => chooseView("split")}
          >
            <i className="fas fa-columns" /> {language === "id" ? "Berdampingan" : "Side by side"}
          </button>
          <button
            type="button"
            className={`btn btn-outline-secondary ${activeOutput !== "change" && displayView === "swipe" ? "active" : ""}`}
            aria-pressed={activeOutput !== "change" && displayView === "swipe"}
            onClick={() => chooseView("swipe")}
          >
            <i className="fas fa-arrows-alt-h" /> {language === "id" ? "Geser" : "Swipe"}
          </button>
        </div>
      </div>
      <div className="card-body">
        {(imagery.pre.length > 0 || imagery.post.length > 0 || aoiFeature) && <div className="row g-2 mb-3 disaster-imagery-selectors">
          <div className="col-sm-6">
            <label className="form-label small fw-semibold mb-1" htmlFor="disaster-pre-scene">{language === "id" ? "Citra Sebelum (Pre)" : "Before Imagery (Pre)"}</label>
            <select
              className="form-select form-select-sm"
              id="disaster-pre-scene"
              value={preSelection}
              onChange={(e) => {
                const value = e.target.value;
                setOutput("imagery");
                if (value.startsWith("source:")) {
                  setPreId(null);
                  setPreSource(value.slice("source:".length) as DynamicImagerySource);
                } else {
                  setPreSource(null);
                  setPreId(value ? Number(value) : null);
                }
              }}
              disabled={!imagery.pre.length && !aoiFeature}
            >
              {!imagery.pre.length && <option value="">Tidak tersedia</option>}
              {imagery.pre.length > 0 && (
                <optgroup label="Citra tersimpan">
                  {imagery.pre.map((img) => (
                    <option key={img.id} value={img.id}>
                      {imageryLabel(img)}
                      {img.is_primary ? " (utama)" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {aoiFeature && (
                <optgroup label="Sumber tambahan · dipotong sesuai AOI">
                  <option value="source:sentinel2">Sentinel-2 · mosaic AOI</option>
                  <option value="source:esri_wayback">Esri Wayback · snapshot historis</option>
                </optgroup>
              )}
            </select>
            {dynamicPreLoading && <div className="small text-muted mt-1" role="status">Memuat citra pra-bencana dan memotong sesuai AOI...</div>}
            {dynamicPreError && <div className="small text-danger mt-1" role="alert">{dynamicPreError}</div>}
          </div>
          <div className="col-sm-6">
            <label className="form-label small fw-semibold mb-1" htmlFor="disaster-post-scene">{language === "id" ? "Citra Sesudah (Post)" : "After Imagery (Post)"}</label>
            <select
              className="form-select form-select-sm"
              id="disaster-post-scene"
              value={postSelection}
              onChange={(e) => {
                const value = e.target.value;
                setOutput("imagery");
                if (value.startsWith("source:")) {
                  setPostId(null);
                  setPostSource(value.slice("source:".length) as DynamicImagerySource);
                } else {
                  setPostSource(null);
                  setPostId(value ? Number(value) : null);
                }
              }}
              disabled={!imagery.post.length && !aoiFeature}
            >
              {!imagery.post.length && !aoiFeature && <option value="">Tidak tersedia</option>}
              {imagery.post.length > 0 && (
                <optgroup label="Citra tersimpan">
                  {imagery.post.map((img) => (
                    <option key={img.id} value={img.id}>
                      {imageryLabel(img)}
                      {img.is_primary ? " (utama)" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {aoiFeature && (
                <optgroup label="Sumber tambahan · dipotong sesuai AOI">
                  <option value="source:sentinel2">Sentinel-2 · mosaic AOI</option>
                  <option value="source:esri_wayback">Esri Wayback · snapshot historis</option>
                </optgroup>
              )}
            </select>
            {dynamicPostLoading && <div className="small text-muted mt-1" role="status">Memuat citra pasca-bencana dan memotong sesuai AOI…</div>}
            {dynamicPostError && <div className="small text-danger mt-1" role="alert">{dynamicPostError}</div>}
          </div>
        </div>}

        {comparison && <div className="disaster-comparison-controls mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            {comparisonEntries.length > 1 && <>
              <label className="small fw-semibold" htmlFor="disaster-comparison-result">{language === "id" ? "Hasil analisis" : "Analysis result"}</label>
              <select id="disaster-comparison-result" className="form-select form-select-sm disaster-comparison-result"
                value={comparisonEntry.model_id} onChange={e => setComparisonId(e.target.value)}>
                {comparisonEntries.map(entry => <option key={entry.model_id} value={entry.model_id}>{entry.user_label}</option>)}
              </select>
            </>}
            <div className="btn-group btn-group-sm" role="group" aria-label={language === "id" ? "Layer yang ditampilkan" : "Displayed layer"}>
              {([
                ["imagery", language === "id" ? "Citra satelit" : "Satellite imagery", true],
                ["classes", language === "id" ? "Segmentasi multi-kelas" : "Multi-class segmentation", !!(comparison.pre_tile_url || comparison.post_tile_url)],
                ["change", language === "id" ? "Perubahan" : "Change", !!comparison.change_tile_url],
              ] as const).map(([key, label, available]) => <button key={key} type="button"
                className={`btn btn-outline-secondary ${activeOutput === key ? "active" : ""}`}
                aria-pressed={activeOutput === key} disabled={!available} onClick={() => setOutput(key)}>{label}</button>)}
            </div>
            <label className="small segmentation-comparison__opacity">{opacityLabel}
              <input aria-label={opacityLabel} type="range" min="0" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} />
            </label>
          </div>
          <SegmentationSummary result={comparison} tileError={analysisVisible && tileErrorSource === tileErrorKey} />
          <p className="small text-muted mb-0">{language === "id"
            ? "Dropdown scene menampilkan citra referensi. Segmentasi dan perubahan memakai tanggal hasil analisis yang tercantum di atas."
            : "Scene selectors show reference imagery. Segmentation and change use the analysis dates shown above."}</p>
        </div>}

        {(displayView === "pre" || displayView === "post") && <>
          {renderMap(displayView, showGlobeControl)}
          <div className="text-center small text-muted mt-1">{displayView === "pre" ? preLabel : postLabel}</div>
        </>}
        {displayView === "split" && <div className="row g-2">
          <div className="col-md-6">{renderMap("pre", showGlobeControl)}<div className="text-center small text-muted mt-1">{preLabel}</div></div>
          <div className="col-md-6">{renderMap("post", false)}<div className="text-center small text-muted mt-1">{postLabel}</div></div>
        </div>}
        {displayView === "swipe" && <SwipeCompareMap id="disasterSatSwipeMap"
          beforeUrl={displayPreTile} afterUrl={displayPostTile} beforeLabel={preLabel} afterLabel={postLabel}
          beforeAttribution={displayPreAttribution} afterAttribution={displayPostAttribution}
          orientation={swipeOrientation} onOrientationChange={setSwipeOrientation} opacity={opacity}
          beforeCrossOrigin={!analysisVisible && preImg?.source_kind === "local_upload" ? "use-credentials" : undefined}
          afterCrossOrigin={!analysisVisible && postImg?.source_kind === "local_upload" ? "use-credentials" : undefined}
          maxZoom={DISASTER_SCENE_MAX_ZOOM} beforeResolutionM={displayPreResolution ?? undefined} afterResolutionM={displayPostResolution ?? undefined}
          beforeMaxNativeZoom={displayPreNativeZoom} afterMaxNativeZoom={displayPostNativeZoom}
          historicalDate={historicalDate("post") ?? historicalDate("pre")} showGlobeControl={showGlobeControl}
          initialPercent={35} bounds={displayBounds} clipGeometry={displayAoi}>
          <LayerOpacityControl opacity={opacity} onChange={setOpacity} label={opacityLabel} />
          {sharedLayers}
        </SwipeCompareMap>}
        {comparison && <SegmentationStatistics key={comparisonEntry.model_id} result={comparison} />}
      </div>
    </div>
  );
}
