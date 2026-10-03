import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { ESRI_WAYBACK_START_DATE, listEsriWaybackScenes, selectEsriWaybackScene, type WaybackScene } from "@/features/imagery/wayback";
import { clampNasaGibsDate, nasaGibsTrueColorTileUrl } from "@/features/imagery/nasaGibs";
import { useBasemapContext } from "./BasemapContext";
import "./map-tools.css";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
const CURRENT_SCENE_ID = "current";

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
  const { activeBasemapId, setHistoricalImageryDate } = useBasemapContext();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historySource, setHistorySource] = useState<"esri-wayback" | "nasa-gibs">("esri-wayback");
  const [nasaDate, setNasaDate] = useState(() => dateFromQuery() ?? today);
  const [tileError, setTileError] = useState(false);
  const [queryDate, setQueryDate] = useState<string | undefined>(() => dateFromQuery());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const analysisDate = targetDate ?? queryDate;
  const visible = open && enabled;
  const { data: scenes = [], isFetching, isError, refetch } = useQuery({
    queryKey: ["map-wayback-releases", analysisDate ?? today],
    queryFn: async () => (await listEsriWaybackScenes(ESRI_WAYBACK_START_DATE, today, Infinity)).reverse(),
    enabled: historySource === "esri-wayback" && enabled && (visible || Boolean(analysisDate)),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
  const entries = [...scenes, { id: CURRENT_SCENE_ID, release_label: today, tile_url: "" }];
  const autoScene = analysisDate ? selectEsriWaybackScene(scenes as WaybackScene[], analysisDate) : null;
  const effectiveSelectedId = selectedId ?? autoScene?.id ?? CURRENT_SCENE_ID;
  const foundIndex = entries.findIndex(scene => scene.id === effectiveSelectedId);
  const index = foundIndex >= 0 ? foundIndex : entries.length - 1;
  const selected = entries[index] ?? entries[entries.length - 1];
  const isCurrent = historySource === "esri-wayback" && selected.id === CURRENT_SCENE_ID;
  const effectiveNasaDate = clampNasaGibsDate(nasaDate, today);
  const selectedTileUrl = selected?.tile_url ?? "";
  const selectedReleaseDate = selected?.release_label ?? today;

  useEffect(() => {
    const sync = () => setQueryDate(dateFromQuery());
    window.addEventListener("popstate", sync);
    window.addEventListener("savegeo:map-query", sync);
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("savegeo:map-query", sync); };
  }, []);

  useEffect(() => { setSelectedId(null); }, [queryDate, targetDate]);
  useEffect(() => { if (analysisDate) setNasaDate(analysisDate); }, [analysisDate]);

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
    setOpen(false);
    setHistorySource("esri-wayback");
    setSelectedId(CURRENT_SCENE_ID);
    setTileError(false);
  }, [activeBasemapId]);

  useEffect(() => {
    const shouldShowHistorical = enabled && (historySource === "nasa-gibs" || (!isCurrent && (visible || Boolean(analysisDate))));
    if (!shouldShowHistorical || (historySource === "esri-wayback" && isFetching)) { setTileError(false); return; }
    const paneName = "historical-imagery";
    const pane = map.getPane(paneName) ?? map.createPane(paneName);
    pane.style.zIndex = "250";
    pane.style.pointerEvents = "none";
    setTileError(false);
    const tileUrl = historySource === "nasa-gibs" ? nasaGibsTrueColorTileUrl(effectiveNasaDate) : selectedTileUrl;
    const attribution = historySource === "nasa-gibs"
      ? `<a href="https://earthdata.nasa.gov/" target="_blank" rel="noreferrer">NASA Earthdata GIBS</a> · MODIS Terra Corrected Reflectance True Color · ${effectiveNasaDate}`
      : `Esri World Imagery Wayback · Rilis ${selectedReleaseDate}`;
    const layer = L.tileLayer(tileUrl, {
      pane: paneName,
      maxNativeZoom: historySource === "nasa-gibs" ? 9 : 19,
      maxZoom: map.getMaxZoom(),
      attribution,
    });
    const onError = () => setTileError(true);
    layer.on("tileerror", onError);
    layer.addTo(map);
    setHistoricalImageryDate?.(historySource === "nasa-gibs" ? `NASA GIBS ${effectiveNasaDate}` : selectedReleaseDate);
    return () => {
      layer.off("tileerror", onError);
      map.removeLayer(layer);
      setHistoricalImageryDate?.(null);
    };
  }, [activeBasemapId, analysisDate, enabled, effectiveNasaDate, historySource, isCurrent, isFetching, map, selectedReleaseDate, selectedTileUrl, setHistoricalImageryDate, visible]);

  const choose = (nextIndex: number) => {
    const scene = entries[nextIndex];
    if (scene) setSelectedId(scene.id);
  };
  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const date = selected?.release_label ?? "";
  const years = [...new Set(entries.map(scene => scene.release_label.slice(0, 4)))];
  const months = [...new Set(entries.filter(scene => scene.release_label.startsWith(date.slice(0, 4))).map(scene => scene.release_label.slice(5, 7)))];
  const days = entries.filter(scene => scene.release_label.startsWith(date.slice(0, 7)));
  const choosePrefix = (prefix: string) => {
    const scene = entries.find(item => item.release_label.startsWith(prefix));
    if (scene) setSelectedId(scene.id);
  };

  return <>
    {host && createPortal(<button ref={triggerRef} type="button" className="history-trigger" hidden={!enabled}
      title="Citra historis" aria-label="Citra historis" aria-expanded={visible} aria-controls={panelId}
      onClick={() => setOpen(value => !value)}><i className="bi bi-clock-history" aria-hidden="true" /></button>, host)}
    {visible && createPortal(<div ref={panelRef} id={panelId} className="map-history-panel" role="region" aria-label="Citra historis"
      onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <div className="map-history-heading"><span>{isCurrent ? "Basemap terkini" : "Citra historis"} <small>{historySource === "nasa-gibs" ? "NASA GIBS · MODIS Terra" : isCurrent ? "Tampilan hari ini" : "Esri Wayback"}</small></span><button type="button" onClick={close} aria-label="Tutup citra historis" title="Tutup panel"><i className="bi bi-x-lg" aria-hidden="true" /></button></div>
      <label className="map-history-source">Sumber citra
        <select aria-label="Sumber citra historis" value={historySource} onChange={event => setHistorySource(event.target.value as "esri-wayback" | "nasa-gibs")}>
          <option value="esri-wayback">Esri Wayback · mosaik resolusi tinggi</option>
          <option value="nasa-gibs">NASA GIBS · MODIS harian</option>
        </select>
      </label>
      {historySource === "esri-wayback" && analysisDate && !isCurrent && <p className="map-history-note">Sinkron dengan waktu analisis: <strong>{analysisDate}</strong>. Menampilkan rilis arsip Wayback terdekat yang tersedia.</p>}
      {historySource === "esri-wayback" && isFetching && !scenes.length && <p role="status">Memuat arsip citra...</p>}
      {historySource === "esri-wayback" && isError && <p role="alert">Arsip citra Wayback gagal dimuat. Basemap tetap tersedia. <button type="button" onClick={() => void refetch()}>Coba lagi</button></p>}
      {historySource === "nasa-gibs" ? <>
        <div className="map-history-nasa-date"><label htmlFor={`${panelId}-nasa-date`}>Tanggal citra
          <input id={`${panelId}-nasa-date`} type="date" min="2000-02-24" max={today} value={effectiveNasaDate} onChange={event => { if (event.target.value) setNasaDate(event.target.value); }} />
        </label></div>
        <p className="map-history-note">Citra harian MODIS Terra, resolusi hingga sekitar 250 m/piksel. Arsip tersedia sejak 24 Februari 2000; awan dan mosaik harian dapat memengaruhi tampilan.</p>
        {analysisDate && analysisDate !== effectiveNasaDate && <p className="map-history-note">Tanggal analisis berada di luar rentang arsip; menampilkan <strong>{effectiveNasaDate}</strong>.</p>}
      </> : <>
        <div className="map-history-body">
          <div className="map-history-date">
            <select aria-label="Tahun tampilan" value={date.slice(0, 4)} disabled={isFetching || !entries.length} onChange={event => choosePrefix(event.target.value)}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select>
            <select aria-label="Bulan tampilan" value={date.slice(5, 7)} disabled={isFetching || !entries.length} onChange={event => choosePrefix(`${date.slice(0, 4)}-${event.target.value}`)}>{months.map(month => <option key={month} value={month}>{MONTHS[Number(month) - 1]}</option>)}</select>
            <select aria-label="Hari tampilan" value={selected.id} disabled={isFetching || !days.length} onChange={event => setSelectedId(event.target.value)}>{days.map(scene => <option key={scene.id} value={scene.id}>{Number(scene.release_label.slice(8, 10))}{scene.id === CURRENT_SCENE_ID ? " - Terkini" : ""}</option>)}</select>
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
