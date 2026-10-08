import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { boundsToPayload, type AoiPayload } from "@/features/carbon/lib/geo";
import { getImagerySceneTile, listImageryScenes } from "@/features/imagery/api";
import type { ImageryScene } from "@/features/imagery/types";
import { ESRI_WAYBACK_START_DATE, listEsriWaybackScenes, selectEsriWaybackScene, type WaybackScene } from "@/features/imagery/wayback";
import { clampNasaGibsDate, nasaGibsBlackMarbleTileUrl, NASA_GIBS_BLACK_MARBLE_YEARS, NASA_GIBS_FIRST_DATE, NASA_GIBS_VIIRS_NIGHT_FIRST_DATE, nasaGibsDateAt, nasaGibsDateIndex, nasaGibsTimelineTicks, nasaGibsTrueColorTileUrl, nasaGibsViirsNightTileUrl, type NasaGibsBlackMarbleYear } from "@/features/imagery/nasaGibs";
import { EOX_CLOUDLESS_YEARS, eoxCloudlessTileUrl, type EoxCloudlessYear } from "@/features/imagery/eoxCloudless";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useBasemaps } from "@/hooks/useBasemaps";
import { BASEMAP_FOR_HISTORICAL_SOURCE, historicalSourceForBasemap, type HistoricalImagerySource } from "@/config/historicalBasemapSync";
import { useBasemapContext } from "./BasemapContext";
import { writeGlobeQuery } from "./globe3d/query";
import "./map-tools.css";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
const CURRENT_SCENE_ID = "current";
const COPERNICUS_S2_FIRST_DATE = "2015-06-27";

function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function acquiredDate(scene: ImageryScene): string {
  return scene.acquired_at.slice(0, 10);
}

function sceneIndexAtOrBefore(scenes: ImageryScene[], targetDate: string): number {
  let index = scenes.findIndex((scene) => acquiredDate(scene) > targetDate);
  if (index < 0) return scenes.length - 1;
  return Math.max(0, index - 1);
}

function getCopernicusYearTicks(scenes: ImageryScene[]) {
  const firstSceneByYear = new Map<string, number>();
  scenes.forEach((scene, index) => {
    const year = acquiredDate(scene).slice(0, 4);
    if (!firstSceneByYear.has(year)) firstSceneByYear.set(year, index);
  });
  return [...firstSceneByYear].map(([year, index]) => ({
    year,
    position: index / Math.max(1, scenes.length - 1) * 100,
  }));
}

function viewportAoi(map: L.Map): AoiPayload | null {
  const bounds = map.getBounds().pad(0.15);
  if (!bounds.isValid()) return null;
  const round = (value: number) => Number(value.toFixed(3));
  const aoi = boundsToPayload(L.latLngBounds(
    [Math.max(-85, bounds.getSouth()), Math.max(-180, bounds.getWest())],
    [Math.min(85, bounds.getNorth()), Math.min(180, bounds.getEast())],
  ));
  aoi.west = round(aoi.west);
  aoi.south = round(aoi.south);
  aoi.east = round(aoi.east);
  aoi.north = round(aoi.north);
  return aoi.west < aoi.east && aoi.south < aoi.north ? aoi : null;
}

function dateFromQuery(): string | undefined {
  const query = new URLSearchParams(window.location.search);
  const valid = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  const direct = valid(query.get("time")) ?? valid(query.get("date")) ?? valid(query.get("end_date")) ?? valid(query.get("start_date")) ?? valid(query.get("event_date")) ?? valid(query.get("acquisition_date"));
  if (direct) return direct;
  const year = query.get("year_to") ?? query.get("year") ?? query.get("end_year");
  return year && /^\d{4}$/.test(year) ? `${year}-12-31` : undefined;
}

type HistoricalAoi = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
function aoiClipPath(aoi: HistoricalAoi, map: L.Map): string {
  if (!aoi) return "";
  const polygons = aoi.geometry.type === "Polygon" ? [aoi.geometry.coordinates] : aoi.geometry.coordinates;
  const origin = map.containerPointToLayerPoint([0, 0]);
  const paths = polygons.flatMap((polygon) => polygon.map((ring) => {
    if (ring.length < 3) return null;
    const points = ring.map(([lng, lat]) => {
      const point = map.latLngToContainerPoint([lat, lng]);
      return `${(point.x + origin.x).toFixed(1)} ${(point.y + origin.y).toFixed(1)}`;
    });
    return `M ${points.join(" L ")} Z`;
  }).filter((path): path is string => Boolean(path)));
  return paths.length ? `path(evenodd, "${paths.join(" ")}")` : 'path("M 0 0 Z")';
}

/** Keep historical tiles inside the selected AOI while the map moves. */
export function HistoricalAoiClipController({ aoi, paneName = "historical-imagery" }: { aoi?: HistoricalAoi; paneName?: string }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const pane = map.getPane(paneName) ?? map.createPane(paneName);
    pane.style.position = "absolute";
    pane.style.left = "0";
    pane.style.top = "0";
    pane.style.overflow = "visible";
    const updateClip = () => {
      const size = map.getSize();
      pane.style.width = `${size.x}px`;
      pane.style.height = `${size.y}px`;
      const clip = aoiClipPath(aoi, map);
      pane.style.clipPath = clip;
      pane.style.setProperty("-webkit-clip-path", clip);
    };
    updateClip();
    map.on("move zoom resize", updateClip);
    return () => {
      map.off("move zoom resize", updateClip);
      pane.style.clipPath = "";
      pane.style.removeProperty("-webkit-clip-path");
    };
  }, [aoi, map, paneName]);
  return null;
}

export default function HistoricalImageryControl({ enabled = true, targetDate }: { enabled?: boolean; targetDate?: string }) {
  const map = useMap();
  const { activeBasemapId, setActiveBasemapId, setHistoricalImageryDate } = useBasemapContext();
  const { basemaps } = useBasemaps();
  const t = useI18nStore((state) => state.t);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const sentinelToday = now.toISOString().slice(0, 10);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historySource, setHistorySource] = useState<HistoricalImagerySource>("current-basemap");
  const [nasaDate, setNasaDate] = useState(() => dateFromQuery() ?? today);
  const [nasaTileDate, setNasaTileDate] = useState(() => dateFromQuery() ?? today);
  const [viirsNightDate, setViirsNightDate] = useState(() => dateFromQuery() ?? today);
  const [viirsNightTileDate, setViirsNightTileDate] = useState(() => dateFromQuery() ?? today);
  const [blackMarbleYear, setBlackMarbleYear] = useState<NasaGibsBlackMarbleYear>(2016);
  const [eoxYear, setEoxYear] = useState<EoxCloudlessYear>(2025);
  const [copernicusSelectedAcquiredAt, setCopernicusSelectedAcquiredAt] = useState<string | null>(null);
  const [copernicusTileSceneId, setCopernicusTileSceneId] = useState<string | null>(null);
  const [copernicusLastTileScene, setCopernicusLastTileScene] = useState<ImageryScene | null>(null);
  const [copernicusAoi, setCopernicusAoi] = useState<AoiPayload | null>(null);
  const [tileError, setTileError] = useState(false);
  const [queryDate, setQueryDate] = useState<string | undefined>(() => dateFromQuery());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const historyDrivenBasemapId = useRef<string | null>(null);
  const panelId = useId();
  const analysisDate = targetDate ?? queryDate;
  const activeBasemap = basemaps.find((basemap) => basemap.id === activeBasemapId);
  const activeBasemapTranslationId = activeBasemap?.id === "satellite_roads" ? "satelliteRoads"
    : activeBasemap?.id === "topo" ? "topographic"
      : activeBasemap?.id === "terrain" ? "terrainRelief" : activeBasemap?.id;
  const activeBasemapName = activeBasemapTranslationId
    ? t(`map.basemap.${activeBasemapTranslationId}`) || activeBasemap?.name || "Basemap aktif"
    : "Basemap aktif";
  const visible = open && enabled;
  const { data: scenes = [], isFetching, isError, refetch } = useQuery({
    queryKey: ["map-wayback-releases", analysisDate ?? today],
    queryFn: async () => (await listEsriWaybackScenes(ESRI_WAYBACK_START_DATE, today, Infinity)).reverse(),
    enabled: historySource === "esri-wayback" && enabled && (visible || Boolean(analysisDate)),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const copernicusViewportKey = copernicusAoi ? JSON.stringify(copernicusAoi) : "no-viewport";
  const copernicusScenesQuery = useQuery({
    queryKey: ["map-copernicus-sentinel2-scenes", copernicusViewportKey, sentinelToday],
    queryFn: () => {
      if (!copernicusAoi) throw new Error("Map bounds are not ready yet");
      return listImageryScenes({
        aoi: copernicusAoi,
        satellite: "sentinel2_l1c",
        startDate: COPERNICUS_S2_FIRST_DATE,
        endDate: addUtcDays(sentinelToday, 1),
        maxCloudCover: 100,
      });
    },
    enabled: historySource === "copernicus-sentinel2" && enabled && Boolean(copernicusAoi),
    staleTime: 60 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    retry: 1,
  });
  const copernicusScenes = useMemo(
    () => [...(copernicusScenesQuery.data?.scenes ?? [])].sort((left, right) => left.acquired_at.localeCompare(right.acquired_at)),
    [copernicusScenesQuery.data?.scenes],
  );
  const copernicusTargetDate = copernicusSelectedAcquiredAt?.slice(0, 10) ?? analysisDate ?? sentinelToday;
  const copernicusDateIndex = copernicusScenes.length
    ? sceneIndexAtOrBefore(copernicusScenes, copernicusTargetDate)
    : -1;
  const explicitCopernicusIndex = copernicusScenes.findIndex((scene) => scene.acquired_at === copernicusSelectedAcquiredAt);
  const copernicusIndex = explicitCopernicusIndex >= 0 ? explicitCopernicusIndex : copernicusDateIndex;
  const copernicusSelectedScene = copernicusScenes[copernicusIndex] ?? null;
  const copernicusSelectedSceneId = copernicusSelectedScene?.id ?? null;
  const copernicusTicks = useMemo(() => getCopernicusYearTicks(copernicusScenes), [copernicusScenes]);
  useEffect(() => {
    if (!copernicusSelectedSceneId) {
      setCopernicusTileSceneId(null);
      return;
    }
    const timer = window.setTimeout(() => setCopernicusTileSceneId(copernicusSelectedSceneId), 350);
    return () => window.clearTimeout(timer);
  }, [copernicusSelectedSceneId]);
  const copernicusTileQuery = useQuery({
    queryKey: ["map-copernicus-sentinel2-scene-tile", copernicusTileSceneId],
    queryFn: () => {
      if (!copernicusTileSceneId) throw new Error("Sentinel-2 scene is not selected");
      return getImagerySceneTile({
        satellite: "sentinel2_l1c",
        sceneId: copernicusTileSceneId,
        forceScene: true,
      });
    },
    enabled: historySource === "copernicus-sentinel2" && enabled && Boolean(copernicusTileSceneId),
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const copernicusTileScene = copernicusScenes.find((scene) => scene.id === copernicusTileQuery.data?.scene_id)
    ?? copernicusLastTileScene;
  useEffect(() => {
    const tileSceneId = copernicusTileQuery.data?.scene_id;
    if (!tileSceneId) return;
    const scene = copernicusScenes.find((item) => item.id === tileSceneId);
    if (scene && (copernicusLastTileScene?.id !== scene.id || copernicusLastTileScene.acquired_at !== scene.acquired_at)) {
      setCopernicusLastTileScene(scene);
    }
  }, [copernicusScenes, copernicusLastTileScene, copernicusTileQuery.data?.scene_id]);
  const copernicusScenesTruncated = copernicusScenesQuery.data?.truncated === true;
  useEffect(() => {
    let previousCenter = map.getCenter();
    let previousZoom = map.getZoom();
    const updateViewport = (force = false) => {
      const center = map.getCenter();
      if (!force && previousCenter.distanceTo(center) < 1_000) return;
      previousCenter = center;
      const next = viewportAoi(map);
      setCopernicusAoi((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    const handleMoveEnd = () => {
      const zoom = map.getZoom();
      const zoomChanged = zoom !== previousZoom;
      previousZoom = zoom;
      if (zoomChanged) {
        if (copernicusScenesTruncated || previousCenter.distanceTo(map.getCenter()) >= 1_000) updateViewport(true);
        else previousCenter = map.getCenter();
        return;
      }
      updateViewport();
    };
    updateViewport(true);
    map.on("moveend", handleMoveEnd);
    return () => { map.off("moveend", handleMoveEnd); };
  }, [copernicusScenesTruncated, map]);
  const entries = [...scenes, { id: CURRENT_SCENE_ID, release_label: today, tile_url: "" }];
  const autoScene = analysisDate ? selectEsriWaybackScene(scenes as WaybackScene[], analysisDate) : null;
  const defaultHistoricalSceneId = autoScene?.id ?? scenes[0]?.id ?? null;
  const effectiveSelectedId = selectedId ?? autoScene?.id ?? CURRENT_SCENE_ID;
  const foundIndex = entries.findIndex(scene => scene.id === effectiveSelectedId);
  const index = foundIndex >= 0 ? foundIndex : entries.length - 1;
  const selected = entries[index] ?? entries[entries.length - 1];
  const isCurrent = historySource === "current-basemap" || (historySource === "esri-wayback" && selected.id === CURRENT_SCENE_ID);
  const effectiveNasaDate = clampNasaGibsDate(nasaDate, today);
  const effectiveNasaTileDate = clampNasaGibsDate(nasaTileDate, today);
  const effectiveViirsNightDate = clampNasaGibsDate(viirsNightDate, today, NASA_GIBS_VIIRS_NIGHT_FIRST_DATE);
  const effectiveViirsNightTileDate = clampNasaGibsDate(viirsNightTileDate, today, NASA_GIBS_VIIRS_NIGHT_FIRST_DATE);
  const nasaDateIndex = nasaGibsDateIndex(effectiveNasaDate, today);
  const nasaMaxDateIndex = nasaGibsDateIndex(today, today);
  const nasaYearTicks = nasaGibsTimelineTicks(today);
  const viirsNightDateIndex = nasaGibsDateIndex(effectiveViirsNightDate, today, NASA_GIBS_VIIRS_NIGHT_FIRST_DATE);
  const viirsNightMaxDateIndex = nasaGibsDateIndex(today, today, NASA_GIBS_VIIRS_NIGHT_FIRST_DATE);
  const viirsNightYearTicks = nasaGibsTimelineTicks(today, NASA_GIBS_VIIRS_NIGHT_FIRST_DATE);
  const isViirsNight = historySource === "nasa-viirs-night";
  const nasaTimelineDate = isViirsNight ? effectiveViirsNightDate : effectiveNasaDate;
  const nasaTimelineIndex = isViirsNight ? viirsNightDateIndex : nasaDateIndex;
  const nasaTimelineMaxDateIndex = isViirsNight ? viirsNightMaxDateIndex : nasaMaxDateIndex;
  const nasaTimelineTicks = isViirsNight ? viirsNightYearTicks : nasaYearTicks;
  const blackMarbleIndex = NASA_GIBS_BLACK_MARBLE_YEARS.indexOf(blackMarbleYear);
  const blackMarbleTicks = NASA_GIBS_BLACK_MARBLE_YEARS.map((year, index) => ({ year: String(year), position: index / (NASA_GIBS_BLACK_MARBLE_YEARS.length - 1) * 100 }));
  const eoxYearIndex = EOX_CLOUDLESS_YEARS.indexOf(eoxYear);
  const eoxYearTicks = EOX_CLOUDLESS_YEARS.map((year, index) => ({ year: String(year), position: index / (EOX_CLOUDLESS_YEARS.length - 1) * 100 }));
  const copernicusTileUrl = copernicusTileQuery.data?.tile_url ?? "";
  const selectedTileUrl = selected?.tile_url ?? "";
  const selectedReleaseDate = selected?.release_label ?? today;

  useEffect(() => {
    const sync = () => setQueryDate(dateFromQuery());
    window.addEventListener("popstate", sync);
    window.addEventListener("savegeo:map-query", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("savegeo:map-query", sync); };
  }, []);

  useEffect(() => {
    setSelectedId(null);
    setCopernicusSelectedAcquiredAt(null);
  }, [queryDate, targetDate]);
  useEffect(() => {
    if (!analysisDate && !copernicusSelectedAcquiredAt && copernicusScenes.length) {
      setCopernicusSelectedAcquiredAt(copernicusScenes[copernicusScenes.length - 1].acquired_at);
    }
  }, [analysisDate, copernicusScenes, copernicusSelectedAcquiredAt]);
  useEffect(() => {
    if (historySource !== "esri-wayback" || isFetching || selected.id !== CURRENT_SCENE_ID) return;
    if (defaultHistoricalSceneId) setSelectedId(defaultHistoricalSceneId);
    else if (!isError) setHistorySource("current-basemap");
  }, [defaultHistoricalSceneId, historySource, isError, isFetching, selected.id]);
  useEffect(() => { if (analysisDate) setNasaDate(analysisDate); }, [analysisDate]);
  useEffect(() => { if (analysisDate) setViirsNightDate(analysisDate); }, [analysisDate]);
  useEffect(() => {
    const timer = window.setTimeout(() => setNasaTileDate(effectiveNasaDate), 220);
    return () => window.clearTimeout(timer);
  }, [effectiveNasaDate]);
  useEffect(() => {
    const timer = window.setTimeout(() => setViirsNightTileDate(effectiveViirsNightDate), 220);
    return () => window.clearTimeout(timer);
  }, [effectiveViirsNightDate]);

  useEffect(() => {
    const control = new L.Control({ position: "topleft" });
    control.onAdd = () => {
      const element = L.DomUtil.create("div", "leaflet-control leaflet-bar history-trigger-control");
      L.DomEvent.disableClickPropagation(element);
      L.DomEvent.disableScrollPropagation(element);
      setHost(element);
      return element;
    };
    control.addTo(map);
    return () => { map.removeControl(control); };
  }, [map]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    L.DomEvent.disableClickPropagation(panel);
    L.DomEvent.disableScrollPropagation(panel);
  }, [visible]);

  useEffect(() => {
    if (!activeBasemapId) return;
    if (historyDrivenBasemapId.current === activeBasemapId) {
      historyDrivenBasemapId.current = null;
      return;
    }
    setHistorySource(historicalSourceForBasemap(activeBasemapId));
    setSelectedId(null);
    setTileError(false);
  }, [activeBasemapId]);

  const chooseHistorySource = (nextSource: HistoricalImagerySource) => {
    setHistorySource(nextSource);
    setSelectedId(null);
    setTileError(false);
    const nextBasemapId = BASEMAP_FOR_HISTORICAL_SOURCE[nextSource];
    if (!nextBasemapId || nextBasemapId === activeBasemapId || !basemaps.some((basemap) => basemap.id === nextBasemapId)) return;
    historyDrivenBasemapId.current = nextBasemapId;
    setActiveBasemapId(nextBasemapId);
    window.localStorage.setItem("savegeo_basemap", nextBasemapId);
    writeGlobeQuery({ basemap: nextBasemapId });
  };

  useEffect(() => {
    const shouldShowHistorical = enabled && historySource !== "current-basemap" && (historySource !== "esri-wayback" || (!isCurrent && (visible || Boolean(analysisDate))));
    if (!shouldShowHistorical || (historySource === "esri-wayback" && isFetching)) { setTileError(false); return; }
    const paneName = "historical-imagery";
    const pane = map.getPane(paneName) ?? map.createPane(paneName);
    pane.style.zIndex = "250";
    pane.style.pointerEvents = "none";
    setTileError(false);
    const tileUrl = historySource === "nasa-gibs"
      ? nasaGibsTrueColorTileUrl(effectiveNasaTileDate)
      : historySource === "nasa-viirs-night"
        ? nasaGibsViirsNightTileUrl(effectiveViirsNightTileDate)
        : historySource === "nasa-black-marble"
        ? nasaGibsBlackMarbleTileUrl(blackMarbleYear)
        : historySource === "eox-cloudless"
          ? eoxCloudlessTileUrl(eoxYear)
      : historySource === "copernicus-sentinel2"
            ? (copernicusSelectedScene ? copernicusTileUrl : "")
          : selectedTileUrl;
    if (!tileUrl) { setTileError(false); return; }
    const attribution = historySource === "nasa-gibs"
      ? `<a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata GIBS</a> - MODIS Terra Corrected Reflectance True Color - ${effectiveNasaTileDate}`
      : historySource === "nasa-viirs-night"
        ? `<a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata GIBS</a> - VIIRS Day/Night Band ENCC - ${effectiveViirsNightTileDate}`
      : historySource === "nasa-black-marble"
        ? `<a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata GIBS</a> - VIIRS Black Marble ${blackMarbleYear}`
      : historySource === "copernicus-sentinel2"
        ? `<a href="https://dataspace.copernicus.eu/" target="_blank" rel="noreferrer">Copernicus Sentinel-2 L1C</a> - Contains modified Copernicus Sentinel data ${copernicusTileScene?.acquired_at.slice(0, 4) ?? sentinelToday.slice(0, 4)}, via <a href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED" target="_blank" rel="noreferrer">Earth Engine</a>`
      : historySource === "eox-cloudless"
          ? `<a href="https://cloudless.eox.at/" target="_blank" rel="noreferrer">EOxCloudless</a> by EOX IT Services GmbH - modified Copernicus Sentinel data ${eoxYear} - <a href="${eoxYear === 2016 ? "https://creativecommons.org/licenses/by/4.0/" : "https://creativecommons.org/licenses/by-nc-sa/4.0/"}" target="_blank" rel="noreferrer">${eoxYear === 2016 ? "CC BY 4.0" : "CC BY-NC-SA 4.0 (non-commercial use)"}</a>`
          : `Esri World Imagery Wayback · Rilis ${selectedReleaseDate}`;
    const maxNativeZoom = historySource === "nasa-gibs" ? 9 : historySource === "nasa-black-marble" || historySource === "nasa-viirs-night" ? 8 : historySource === "eox-cloudless" ? 14 : historySource === "copernicus-sentinel2" ? 16 : 19;
    const layer = L.tileLayer(tileUrl, {
      pane: paneName,
      maxNativeZoom,
      maxZoom: map.getMaxZoom(),
      attribution,
    });
    const onError = () => setTileError(true);
    layer.on("tileerror", onError);
    layer.addTo(map);
    const sourceDate = historySource === "nasa-gibs"
      ? `NASA GIBS ${effectiveNasaTileDate}`
      : historySource === "nasa-viirs-night"
        ? `NASA VIIRS Nighttime ${effectiveViirsNightTileDate}`
      : historySource === "nasa-black-marble"
        ? `NASA Black Marble ${blackMarbleYear}`
      : historySource === "copernicus-sentinel2"
          ? `Copernicus Sentinel-2 ${copernicusTileScene ? `${acquiredDate(copernicusTileScene)} ${copernicusTileScene.acquired_at.slice(11, 16)} UTC` : ""}`
      : historySource === "eox-cloudless"
          ? `EOX Sentinel-2 Cloudless ${eoxYear}`
          : selectedReleaseDate;
    setHistoricalImageryDate?.(sourceDate);
    return () => {
      layer.off("tileerror", onError);
      map.removeLayer(layer);
      setHistoricalImageryDate?.(null);
    };
  }, [activeBasemapId, analysisDate, blackMarbleYear, copernicusTileScene?.id, copernicusTileScene?.acquired_at, copernicusTileUrl, enabled, effectiveNasaTileDate, effectiveViirsNightTileDate, eoxYear, historySource, isCurrent, isFetching, map, selectedReleaseDate, selectedTileUrl, setHistoricalImageryDate, visible]);

  const choose = (nextIndex: number) => {
    const scene = entries[nextIndex];
    if (!scene) return;
    if (scene.id === CURRENT_SCENE_ID) setHistorySource("current-basemap");
    else setSelectedId(scene.id);
  };
  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const date = selected?.release_label ?? "";
  const years = [...new Set(entries.map(scene => scene.release_label.slice(0, 4)))];
  const months = [...new Set(entries.filter(scene => scene.release_label.startsWith(date.slice(0, 4))).map(scene => scene.release_label.slice(5, 7)))];
  const days = entries.filter(scene => scene.release_label.startsWith(date.slice(0, 7)));
  const choosePrefix = (prefix: string) => {
    const scene = entries.find(item => item.release_label.startsWith(prefix));
    if (!scene) return;
    if (scene.id === CURRENT_SCENE_ID) setHistorySource("current-basemap");
    else setSelectedId(scene.id);
  };
  const chooseBlackMarbleIndex = (nextIndex: number) => {
    const year = NASA_GIBS_BLACK_MARBLE_YEARS[nextIndex];
    if (year !== undefined) setBlackMarbleYear(year);
  };
  const chooseEoxYearIndex = (nextIndex: number) => {
    const year = EOX_CLOUDLESS_YEARS[nextIndex];
    if (year !== undefined) setEoxYear(year);
  };
  const chooseCopernicusIndex = (nextIndex: number) => {
    const scene = copernicusScenes[nextIndex];
    if (scene) setCopernicusSelectedAcquiredAt(scene.acquired_at);
  };
  const setNasaTimelineDateAt = (nextIndex: number) => {
    const firstDate = isViirsNight ? NASA_GIBS_VIIRS_NIGHT_FIRST_DATE : NASA_GIBS_FIRST_DATE;
    const nextDate = nasaGibsDateAt(nextIndex, today, firstDate);
    if (isViirsNight) setViirsNightDate(nextDate);
    else setNasaDate(nextDate);
  };
  const sourceLabel = historySource === "current-basemap"
    ? activeBasemapName
    : historySource === "nasa-gibs"
    ? "NASA GIBS - MODIS Terra"
    : historySource === "nasa-viirs-night"
      ? "NASA GIBS - VIIRS nighttime"
      : historySource === "nasa-black-marble"
        ? "NASA GIBS - Black Marble"
        : historySource === "copernicus-sentinel2"
          ? "Copernicus - Sentinel-2 L1C"
        : historySource === "eox-cloudless"
          ? "EOX - Sentinel-2 Cloudless"
          : "Esri Wayback";

  return <>
    {host && createPortal(<button ref={triggerRef} type="button" className="history-trigger" hidden={!enabled}
      title="Citra historis" aria-label="Citra historis" aria-expanded={visible} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}><i className="bi bi-clock-history" aria-hidden="true" /></button>, host)}
    {visible && createPortal(<div ref={panelRef} id={panelId} className="map-history-panel" role="region" aria-label="Citra historis"
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="map-history-heading"><span>{historySource === "current-basemap" ? "Basemap terkini" : "Citra historis"} <small>{sourceLabel}</small></span><button type="button" onClick={close} aria-label="Tutup citra historis" title="Tutup panel"><i className="bi bi-x-lg" aria-hidden="true" /></button></div>
      <label className="map-history-source">Sumber citra
        <select aria-label="Sumber citra historis" value={historySource} onChange={event => chooseHistorySource(event.target.value as HistoricalImagerySource)}>
          <option value="current-basemap">Basemap terkini · {activeBasemapName}</option>
          <option value="esri-wayback">Esri Wayback · mosaik resolusi tinggi</option>
          <option value="nasa-gibs">NASA GIBS - MODIS Terra True Color (harian)</option>
          <option value="nasa-black-marble">NASA GIBS · Black Marble (snapshot 2012/2016)</option>
          <option value="nasa-viirs-night">NASA GIBS - VIIRS Day/Night harian (sejak 2016)</option>
          <option value="eox-cloudless">EOX · Sentinel-2 Cloudless (tahunan)</option>
          <option value="copernicus-sentinel2">Copernicus · Sentinel-2 L1C (scene asli)</option>
        </select>
      </label>
      {activeBasemapId === "nasa-gibs-viirs-night" && <p className="map-history-note">Basemap Earth at Night 2012 adalah komposit tetap. Untuk menelusuri citra malam harian, pilih NASA GIBS - VIIRS malam harian.</p>}
      {activeBasemapId === "nasa-gibs-blue-marble" && <p className="map-history-note">Blue Marble Next Generation adalah komposit global tanpa tanggal historis. Gunakan Esri Wayback, MODIS, atau EOX untuk melihat citra pada waktu berbeda.</p>}
      {historySource === "esri-wayback" && analysisDate && !isCurrent && <p className="map-history-note">Sinkron dengan waktu analisis: <strong>{analysisDate}</strong>. Menampilkan rilis arsip Wayback terdekat yang tersedia.</p>}
      {historySource === "esri-wayback" && isFetching && !scenes.length && <p role="status">Memuat arsip citra...</p>}
      {historySource === "esri-wayback" && isError && <p role="alert">Arsip citra Wayback gagal dimuat. Basemap tetap tersedia. <button type="button" onClick={() => void refetch()}>Coba lagi</button></p>}
      {historySource === "current-basemap"
        ? <p className="map-history-note">Peta menampilkan basemap aktif: <strong>{activeBasemapName}</strong>. Pilih sumber lain untuk menampilkan citra historis.</p>
        : historySource === "nasa-gibs" || historySource === "nasa-viirs-night" ? <>
        <div className="map-history-body map-history-nasa-body">
          <div className="map-history-nasa-selected-date"><small>{isViirsNight ? "Tanggal malam VIIRS" : "Tanggal citra"}</small><strong>{nasaTimelineDate}</strong></div>
          <div className="map-history-slider">
            <div className="map-history-track">
              <button type="button" aria-label={isViirsNight ? "Tanggal VIIRS sebelumnya" : "Tanggal NASA sebelumnya"} disabled={nasaTimelineIndex === 0}
                onClick={() => setNasaTimelineDateAt(nasaTimelineIndex - 1)}>&lsaquo;</button>
              <input id={`${panelId}-nasa-date`} type="range" aria-label={isViirsNight ? "Linimasa malam VIIRS harian" : "Linimasa citra MODIS harian"}
                aria-valuetext={nasaTimelineDate} min={0} max={nasaTimelineMaxDateIndex} step={1} value={nasaTimelineIndex}
                onChange={event => setNasaTimelineDateAt(Number(event.target.value))} />
              <button type="button" aria-label={isViirsNight ? "Tanggal VIIRS berikutnya" : "Tanggal NASA berikutnya"} disabled={nasaTimelineIndex === nasaTimelineMaxDateIndex}
                onClick={() => setNasaTimelineDateAt(nasaTimelineIndex + 1)}>&rsaquo;</button>
            </div>
            <div className="map-history-ruler" aria-hidden="true">
              {nasaTimelineTicks.map(({ year, position }) => <span key={year} style={{ left: `${position}%` }}>{year}</span>)}
            </div>
          </div>
        </div>
        {isViirsNight
          ? <p className="map-history-note">Citra malam VIIRS Day/Night Band tersedia harian sejak 3 Desember 2016. Tampilan skala abu-abu dapat berubah karena pantulan cahaya Bulan, awan, dan sumber cahaya di permukaan.</p>
          : <p className="map-history-note">Citra harian MODIS Terra, hingga sekitar 250 m/piksel. Area hitam dapat muncul sebagai celah sapuan orbit pada tanggal tersebut; tutupan awan juga memengaruhi citra.</p>}
        {analysisDate && analysisDate !== nasaTimelineDate && <p className="map-history-note">Tanggal analisis berada di luar rentang arsip; menampilkan <strong>{nasaTimelineDate}</strong>.</p>}
      </> : historySource === "nasa-black-marble" ? <>
        <div className="map-history-body map-history-nasa-body">
          <div className="map-history-nasa-selected-date"><small>Snapshot komposit</small><strong>{blackMarbleYear}</strong></div>
          <div className="map-history-slider">
            <div className="map-history-track">
              <button type="button" aria-label="Snapshot Black Marble sebelumnya" disabled={blackMarbleIndex === 0}
                onClick={() => chooseBlackMarbleIndex(blackMarbleIndex - 1)}>‹</button>
              <input type="range" aria-label="Snapshot Black Marble" aria-valuetext={`Komposit ${blackMarbleYear}`} min={0}
                max={NASA_GIBS_BLACK_MARBLE_YEARS.length - 1} step={1} value={blackMarbleIndex}
                onChange={event => chooseBlackMarbleIndex(Number(event.target.value))} />
              <button type="button" aria-label="Snapshot Black Marble berikutnya" disabled={blackMarbleIndex === NASA_GIBS_BLACK_MARBLE_YEARS.length - 1}
                onClick={() => chooseBlackMarbleIndex(blackMarbleIndex + 1)}>›</button>
            </div>
            <div className="map-history-ruler" aria-hidden="true">
              {blackMarbleTicks.map(({ year, position }) => <span key={year} style={{ left: `${position}%` }}>{year}</span>)}
            </div>
          </div>
        </div>
        <p className="map-history-note">Black Marble adalah peta cahaya malam antropogenik berbasis VIIRS, bukan peta jalan atau batas administrasi. NASA GIBS menyediakan dua snapshot komposit—2012 dan 2016—bukan arsip tahunan; untuk citra malam harian pilih VIIRS Day/Night.</p>
      </> : historySource === "eox-cloudless" ? <>
        <div className="map-history-body map-history-nasa-body">
          <div className="map-history-nasa-selected-date"><small>Tahun mosaik</small><strong>{eoxYear}</strong></div>
          <div className="map-history-slider">
            <div className="map-history-track">
              <button type="button" aria-label="Mosaik EOX sebelumnya" disabled={eoxYearIndex === 0}
                onClick={() => chooseEoxYearIndex(eoxYearIndex - 1)}>‹</button>
              <input type="range" aria-label="Linimasa mosaik EOX Sentinel-2" aria-valuetext={String(eoxYear)} min={0}
                max={EOX_CLOUDLESS_YEARS.length - 1} step={1} value={eoxYearIndex}
                onChange={event => chooseEoxYearIndex(Number(event.target.value))} />
              <button type="button" aria-label="Mosaik EOX berikutnya" disabled={eoxYearIndex === EOX_CLOUDLESS_YEARS.length - 1}
                onClick={() => chooseEoxYearIndex(eoxYearIndex + 1)}>›</button>
            </div>
            <div className="map-history-ruler" aria-hidden="true">
              {eoxYearTicks.map(({ year, position }) => <span key={year} style={{ left: `${position}%` }}>{year}</span>)}
            </div>
          </div>
        </div>
        <p className="map-history-note">Mosaik tahunan tersedia untuk 2016 dan 2018–2025; data 2017 tidak tersedia. Mosaik 2018–2025 berlisensi CC BY-NC-SA 4.0 dan hanya untuk penggunaan nonkomersial; mosaik 2016 berlisensi CC BY 4.0.</p>
      </> : historySource === "copernicus-sentinel2" ? <>
        <div className="map-history-body map-history-copernicus-body">
          <div className="map-history-nasa-selected-date"><small>Tanggal akuisisi scene</small><strong>{copernicusSelectedScene ? `${acquiredDate(copernicusSelectedScene)} · ${copernicusSelectedScene.acquired_at.slice(11, 16)} UTC` : "—"}</strong></div>
          <div className="map-history-slider">
            <div className="map-history-track">
              <button type="button" aria-label="Scene Sentinel-2 sebelumnya" disabled={copernicusIndex <= 0}
                onClick={() => chooseCopernicusIndex(copernicusIndex - 1)}>&lsaquo;</button>
              <input type="range" aria-label="Linimasa scene Copernicus Sentinel-2" aria-valuetext={copernicusSelectedScene?.acquired_at ?? "Belum ada scene"}
                min={0} max={Math.max(0, copernicusScenes.length - 1)} step={1} value={Math.max(0, copernicusIndex)} disabled={!copernicusScenes.length}
                onChange={(event) => chooseCopernicusIndex(Number(event.target.value))} />
              <button type="button" aria-label="Scene Sentinel-2 berikutnya" disabled={copernicusIndex < 0 || copernicusIndex >= copernicusScenes.length - 1}
                onClick={() => chooseCopernicusIndex(copernicusIndex + 1)}>&rsaquo;</button>
            </div>
            <div className="map-history-ruler" aria-hidden="true">
              {copernicusTicks.map(({ year, position }) => <span key={year} style={{ left: `${position}%` }}>{year}</span>)}
            </div>
          </div>
        </div>
        {copernicusScenesQuery.isFetching && !copernicusScenes.length && <p role="status" className="map-history-note">Mencari tanggal akuisisi Sentinel-2 di area peta...</p>}
        {copernicusScenesQuery.isError && <p role="alert" className="map-history-note">Daftar scene Sentinel-2 gagal dimuat. <button type="button" onClick={() => void copernicusScenesQuery.refetch()}>Coba lagi</button></p>}
        {!copernicusScenesQuery.isFetching && !copernicusScenesQuery.isError && !copernicusScenes.length && <p role="status" className="map-history-note">Tidak ada scene Sentinel-2 pada area peta.</p>}
        {copernicusTileQuery.isFetching && <p role="status" className="map-history-note">Menyiapkan tile scene Sentinel-2...</p>}
        {copernicusTileQuery.isError && <p role="alert" className="map-history-note">Tile scene Sentinel-2 gagal dimuat. <button type="button" onClick={() => void copernicusTileQuery.refetch()}>Coba lagi</button></p>}
        {copernicusScenes.length > 0 && <p className="map-history-note">{copernicusScenes.length}{copernicusScenesQuery.data?.truncated ? "+" : ""} akuisisi tersedia untuk area peta. Tiap posisi slider menampilkan satu scene L1C pada tanggal dan waktu akuisisinya.</p>}
        {copernicusScenesTruncated && <p className="map-history-note">Jumlah scene di area ini melewati batas hasil. Perbesar peta atau geser ke area yang lebih kecil untuk memuat arsip lokal.</p>}
        <p className="map-history-note">Arsip Copernicus Sentinel-2 L1C tersedia sejak 27 Juni 2015. L1C adalah reflektansi TOA (belum dikoreksi atmosfer); awan tetap dapat terlihat.</p>
      </> : <>
        <div className="map-history-body">
          <div className="map-history-date">
            <select aria-label="Tahun tampilan" value={date.slice(0, 4)} disabled={isFetching || !entries.length} onChange={event => choosePrefix(event.target.value)}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select>
            <select aria-label="Bulan tampilan" value={date.slice(5, 7)} disabled={isFetching || !entries.length} onChange={event => choosePrefix(`${date.slice(0, 4)}-${event.target.value}`)}>{months.map(month => <option key={month} value={month}>{MONTHS[Number(month) - 1]}</option>)}</select>
            <select aria-label="Hari tampilan" value={selected.id} disabled={isFetching || !days.length} onChange={event => {
              if (event.target.value === CURRENT_SCENE_ID) setHistorySource("current-basemap");
              else setSelectedId(event.target.value);
            }}>{days.map(scene => <option key={scene.id} value={scene.id}>{Number(scene.release_label.slice(8, 10))}{scene.id === CURRENT_SCENE_ID ? " - Terkini" : ""}</option>)}</select>
          </div>
          <div className="map-history-slider">
            <div className="map-history-track"><button type="button" aria-label="Rilis sebelumnya" disabled={index === 0} onClick={() => choose(index - 1)}>‹</button>
              <input type="range" aria-label="Linimasa citra historis" aria-valuetext={isCurrent ? `Basemap terkini, diakses ${today}` : `Rilis ${date}`} min={0} max={entries.length - 1} value={index} onChange={event => choose(Number(event.target.value))} />
              <button type="button" aria-label="Rilis berikutnya" disabled={index === entries.length - 1} onClick={() => choose(index + 1)}>›</button></div>
            <div className="map-history-ruler" aria-hidden="true">{years.filter((_, i) => i % Math.max(1, Math.ceil(years.length / 6)) === 0).map(year => <span key={year} style={{ left: `${entries.findIndex(scene => scene.release_label.startsWith(year)) / Math.max(1, entries.length - 1) * 100}%` }}>{year}</span>)}</div>
          </div>
        </div>
        <p className="map-history-note">{isCurrent
          ? `Diakses ${today}. Basemap terbaru yang tersedia; bukan tanggal perekaman citra.`
          : "Tanggal rilis arsip; tanggal perekaman citra dapat berbeda menurut lokasi."}
          {!isCurrent && <> <button type="button" onClick={() => { setSelectedId(CURRENT_SCENE_ID); setTileError(false); }}>Kembali ke terkini</button></>}
        </p>
      </>}
      {tileError && <p role="alert">Sebagian citra gagal dimuat. Coba tanggal lain atau perkecil zoom.</p>}
    </div>, map.getContainer())}
  </>;
}
