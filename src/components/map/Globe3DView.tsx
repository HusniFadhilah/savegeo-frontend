import { useEffect, useRef, useState } from "react";
import * as C from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { GlobeLayer, GlobeViewProps } from "./GlobeView";
import { useBasemaps } from "@/hooks/useBasemaps";
import { useAoiStore } from "@/hooks/useAoiStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useUserGeolocation, useLocationStore } from "@/hooks/useUserGeolocation";
import UserLocationControl from "./UserLocationControl";
import { imageryProvider } from "./globe3d/imagery";
import { cameraNumber, useGlobeQuery, writeGlobeQuery } from "./globe3d/query";
import "./globe3d/globe.css";

const EMPTY_LAYERS: GlobeLayer[] = [];
const env = import.meta.env;
const terrainConfigured = Boolean(env.VITE_CESIUM_TERRAIN_URL || env.VITE_CESIUM_ION_TOKEN);
const buildingsConfigured = Boolean(env.VITE_CESIUM_BUILDINGS_URL || (env.VITE_CESIUM_ION_TOKEN && env.VITE_CESIUM_BUILDINGS_ASSET_ID));
// Ion endpoint authorization travels in a header, never in the page or request URL.
async function ionResource(asset: number) {
  if (!Number.isSafeInteger(asset) || asset <= 0) throw new Error("Invalid asset");
  const response = await fetch(`https://api.cesium.com/v1/assets/${asset}/endpoint`, { headers: { Authorization: `Bearer ${env.VITE_CESIUM_ION_TOKEN}` } });
  if (!response.ok) throw new Error("Provider unavailable");
  const endpoint = await response.json();
  if (!endpoint.url || !endpoint.accessToken) throw new Error("Unsupported provider");
  return { resource: new C.Resource({ url: endpoint.url, headers: { Authorization: `Bearer ${endpoint.accessToken}` } }), credits: (endpoint.attributions ?? []).map((a: { html: string; collapsible?: boolean }) => new C.Credit(a.html, !a.collapsible)) as C.Credit[] };
}

export default function Globe3DView(props: GlobeViewProps) {
  const { id, layers = EMPTY_LAYERS, showControls = true, className } = props;
  const container = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<C.Viewer | null>(null);
  const latest = useRef(props); latest.current = props;
  const [viewer, setViewer] = useState<C.Viewer | null>(null);
  const [error, setError] = useState("");
  const [imageryError, setImageryError] = useState(false);
  const [layerError, setLayerError] = useState(false);
  const [terrainStatus, setTerrainStatus] = useState("terrainUnavailable");
  const [buildingStatus, setBuildingStatus] = useState("buildingsUnavailable");
  const [heading, setHeading] = useState(0);
  const aoiSource = useRef<C.GeoJsonDataSource | null>(null);
  const privateCamera = useRef(false);
  const restoreInitialCamera = useRef(new URLSearchParams(window.location.search).has("globe_height"));
  const location = useUserGeolocation();
  const locationRevision = useRef(location.revision);
  const { basemaps } = useBasemaps();
  const sharedAoi = useAoiStore(s => s.aoi);
  const aoi = props.aoi === undefined ? sharedAoi?.feature : props.aoi;
  const t = useI18nStore(s => s.t);
  const query = useGlobeQuery();
  const basemapId = query.get("basemap") ?? props.basemapId;
  const alias = basemapId === "terrain_relief" ? "terrain" : basemapId === "topographic" ? "topo" : basemapId;
  const basemap = basemaps.find(b => b.id === alias) ?? basemaps.find(b => b.isDefault) ?? basemaps[0];
  const terrain = query.get("show_terrain") !== "false";
  const buildings = query.get("show_buildings") === "true";
  const showAoi = query.get("show_aoi") !== "false";
  const labels = query.get("show_labels") !== "false";
  const roads = query.get("show_roads") !== "false";
  const exaggeration = cameraNumber(query, "terrain_exaggeration", 1, 0.5, 3);
  const lighting = query.get("show_lighting") === "true";

  const indonesia = () => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    privateCamera.current = false;
    v.camera.flyTo({ destination: C.Cartesian3.fromDegrees(118, -2.5, 6500000), orientation: { heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0 } });
  };
  const home = () => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    privateCamera.current = false;
    if (aoiSource.current) void v.flyTo(aoiSource.current, { offset: new C.HeadingPitchRange(0, -C.Math.PI_OVER_FOUR, 0) }).catch(() => undefined);
    else indonesia();
  };

  useEffect(() => {
    if (!container.current) return;
    let v: C.Viewer;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      C.Ion.defaultAccessToken = "";
      v = new C.Viewer(container.current, { baseLayer: false, baseLayerPicker: false, terrainProvider: new C.EllipsoidTerrainProvider(), animation: false, timeline: false, geocoder: false, homeButton: false, sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, selectionIndicator: true, infoBox: true, requestRenderMode: true, maximumRenderTimeChange: Infinity });
      viewerRef.current = v;
      v.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5) / (window.devicePixelRatio || 1);
      v.scene.globe.maximumScreenSpaceError = 3;
      v.scene.screenSpaceCameraController.minimumZoomDistance = 20;
      v.scene.screenSpaceCameraController.maximumZoomDistance = 40000000;
      // Cesium defaults: left drag globe, right drag zoom, middle/Ctrl drag tilt.
      v.scene.screenSpaceCameraController.tiltEventTypes = [C.CameraEventType.MIDDLE_DRAG, C.CameraEventType.PINCH, { eventType: C.CameraEventType.LEFT_DRAG, modifier: C.KeyboardEventModifier.CTRL }];
      const restoreCamera = () => {
        const q = new URLSearchParams(window.location.search);
        const center = latest.current.center ?? [-2.5, 118];
        v.camera.setView({ destination: C.Cartesian3.fromDegrees(cameraNumber(q, "globe_lng", center[1], -180, 180), cameraNumber(q, "globe_lat", center[0], -90, 90), cameraNumber(q, "globe_height", 6500000, 20, 40000000)), orientation: { heading: C.Math.toRadians(cameraNumber(q, "globe_heading", 0, -360, 360)), pitch: C.Math.toRadians(cameraNumber(q, "globe_pitch", -90, -90, 0)), roll: C.Math.toRadians(cameraNumber(q, "globe_roll", 0, -180, 180)) } });
      };
      restoreCamera();
      const onMove = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (v.isDestroyed()) return;
          setHeading(Math.round(C.Math.toDegrees(v.camera.heading)));
          if (privateCamera.current || useLocationStore.getState().follow) return;
          const position = v.camera.positionCartographic;
          writeGlobeQuery({ globe_lat: C.Math.toDegrees(position.latitude).toFixed(5), globe_lng: C.Math.toDegrees(position.longitude).toFixed(5), globe_height: Math.round(position.height), globe_heading: C.Math.toDegrees(v.camera.heading).toFixed(2), globe_pitch: C.Math.toDegrees(v.camera.pitch).toFixed(2), globe_roll: C.Math.toDegrees(v.camera.roll).toFixed(2) });
        }, 500);
      };
      const removeMove = v.camera.moveEnd.addEventListener(onMove);
      const removeError = v.scene.renderError.addEventListener(() => setError("loadError"));
      const doubleClick = new C.ScreenSpaceEventHandler(v.scene.canvas);
      doubleClick.setInputAction((event: { position: C.Cartesian2 }) => {
        const ray = v.camera.getPickRay(event.position);
        const point = ray && v.scene.globe.pick(ray, v.scene);
        if (!point) return;
        const c = C.Cartographic.fromCartesian(point);
        v.camera.flyTo({ destination: C.Cartesian3.fromRadians(c.longitude, c.latitude, Math.max(200, v.camera.positionCartographic.height / 3)) });
      }, C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      v.screenSpaceEventHandler.removeInputAction(C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
      const resize = new ResizeObserver(() => { if (!v.isDestroyed()) { v.resize(); v.scene.requestRender(); } });
      resize.observe(container.current);
      window.addEventListener("popstate", restoreCamera);
      setViewer(v);
      latest.current.onReady?.(v);
      return () => {
        clearTimeout(timer); resize.disconnect(); removeMove(); removeError(); doubleClick.destroy();
        window.removeEventListener("popstate", restoreCamera);
        if (!v.isDestroyed()) v.destroy();
        viewerRef.current = null;
      };
    } catch {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) viewerRef.current.destroy();
      viewerRef.current = null;
      setError("webglUnavailable");
    }
  }, [id]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !basemap) return;
    const installed: C.ImageryLayer[] = [];
    const removers: (() => void)[] = [];
    setImageryError(false);
    const add = (url: string, credit: string | undefined, index: number, overlay = false) => {
      const provider = imageryProvider(url, credit, basemap.maxNativeZoom ?? basemap.maxZoom, overlay ? undefined : basemap.wmts);
      removers.push(provider.errorEvent.addEventListener(() => setImageryError(true)));
      installed.push(viewer.imageryLayers.addImageryProvider(provider, index));
    };
    try {
      add(basemap.url, basemap.attribution, 0);
      if (basemap.overlayUrl && roads) add(basemap.overlayUrl, basemap.overlayAttribution, 1, true);
      if (basemap.labelsUrl && labels) add(basemap.labelsUrl, basemap.labelsAttribution, installed.length, true);
    } catch { setImageryError(true); }
    viewer.scene.requestRender();
    return () => { removers.forEach(fn => fn()); if (!viewer.isDestroyed()) installed.forEach(layer => viewer.imageryLayers.remove(layer, true)); };
  }, [viewer, basemap, roads, labels]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    let cancelled = false;
    let removeError: (() => void) | undefined;
    let credits: C.Credit[] = [];
    viewer.terrainProvider = new C.EllipsoidTerrainProvider();
    setTerrainStatus(terrainConfigured ? "terrainOff" : "terrainUnavailable");
    if (terrain && terrainConfigured) {
      setTerrainStatus("loading");
      void (async () => {
        const source = env.VITE_CESIUM_TERRAIN_URL ? { resource: new C.Resource({ url: env.VITE_CESIUM_TERRAIN_URL }), credits: [] } : await ionResource(Number(env.VITE_CESIUM_TERRAIN_ASSET_ID || 1));
        const provider = await C.CesiumTerrainProvider.fromUrl(source.resource, { requestVertexNormals: true });
        if (cancelled || viewer.isDestroyed()) return;
        credits = source.credits;
        credits.forEach(credit => viewer.creditDisplay.addStaticCredit(credit));
        removeError = provider.errorEvent.addEventListener(() => { if (!cancelled && !viewer.isDestroyed()) { viewer.terrainProvider = new C.EllipsoidTerrainProvider(); setTerrainStatus("terrainUnavailable"); viewer.scene.requestRender(); } });
        viewer.terrainProvider = provider;
        setTerrainStatus("terrainActive"); viewer.scene.requestRender();
      })().catch(() => { if (!cancelled) setTerrainStatus("terrainUnavailable"); });
    }
    return () => { cancelled = true; removeError?.(); if (!viewer.isDestroyed()) credits.forEach(credit => viewer.creditDisplay.removeStaticCredit(credit)); };
  }, [viewer, terrain]);
  useEffect(() => { if (viewer && !viewer.isDestroyed()) { viewer.scene.verticalExaggeration = exaggeration; viewer.scene.globe.enableLighting = lighting; viewer.scene.requestRender(); } }, [viewer, exaggeration, lighting]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    let cancelled = false;
    let tileset: C.Cesium3DTileset | undefined;
    let credits: C.Credit[] = [];
    setBuildingStatus(buildingsConfigured ? "buildingsOff" : "buildingsUnavailable");
    if (buildings && buildingsConfigured) {
      setBuildingStatus("loading");
      void (async () => {
        const source = env.VITE_CESIUM_BUILDINGS_URL ? { resource: new C.Resource({ url: env.VITE_CESIUM_BUILDINGS_URL }), credits: [] } : await ionResource(Number(env.VITE_CESIUM_BUILDINGS_ASSET_ID));
        const result = await C.Cesium3DTileset.fromUrl(source.resource, { maximumScreenSpaceError: 16 });
        if (cancelled || viewer.isDestroyed()) { result.destroy(); return; }
        tileset = result; credits = source.credits;
        credits.forEach(credit => viewer.creditDisplay.addStaticCredit(credit));
        viewer.scene.primitives.add(result);
        result.tileFailed.addEventListener(() => { if (!cancelled) setBuildingStatus("buildingsUnavailable"); });
        setBuildingStatus("buildingsActive"); viewer.scene.requestRender();
      })().catch(() => { if (!cancelled) setBuildingStatus("buildingsUnavailable"); });
    }
    return () => { cancelled = true; if (!viewer.isDestroyed()) { if (tileset) viewer.scene.primitives.remove(tileset); credits.forEach(credit => viewer.creditDisplay.removeStaticCredit(credit)); } };
  }, [viewer, buildings]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !aoi) return;
    let cancelled = false;
    let source: C.GeoJsonDataSource | undefined;
    void C.GeoJsonDataSource.load(aoi, { clampToGround: true, stroke: C.Color.fromCssColorString("#0d6efd"), strokeWidth: 3, fill: C.Color.fromCssColorString("#0d6efd").withAlpha(0.12) }).then(async result => {
      if (cancelled || viewer.isDestroyed()) { result.entities.removeAll(); return; }
      source = result; aoiSource.current = result;
      result.show = new URLSearchParams(window.location.search).get("show_aoi") !== "false";
      await viewer.dataSources.add(result);
      if (cancelled || viewer.isDestroyed()) return;
      if (!restoreInitialCamera.current) void viewer.flyTo(result, { offset: new C.HeadingPitchRange(0, -C.Math.PI_OVER_FOUR, 0) }).catch(() => undefined);
      viewer.scene.requestRender();
    }).catch(() => { if (!cancelled) setLayerError(true); });
    return () => { cancelled = true; aoiSource.current = null; if (source && !viewer.isDestroyed()) viewer.dataSources.remove(source, true); };
  }, [viewer, aoi]);
  useEffect(() => { if (viewer && !viewer.isDestroyed() && aoiSource.current) { aoiSource.current.show = showAoi; viewer.scene.requestRender(); } }, [viewer, showAoi]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    let cancelled = false;
    const raster: C.ImageryLayer[] = [];
    const sources: C.GeoJsonDataSource[] = [];
    const removers: (() => void)[] = [];
    setLayerError(false);
    for (const layer of layers) {
      if (layer.type === "raster") {
        try {
          const provider = imageryProvider(layer.url, layer.attribution, layer.maxNativeZoom ?? layer.maxZoom ?? 19);
          removers.push(provider.errorEvent.addEventListener(() => setLayerError(true)));
          const installed = viewer.imageryLayers.addImageryProvider(provider);
          installed.alpha = layer.opacity ?? 1; raster.push(installed);
        } catch { setLayerError(true); }
      } else {
        void C.GeoJsonDataSource.load(layer.data, { clampToGround: true, stroke: C.Color.fromCssColorString(layer.color ?? "#0d6efd"), fill: C.Color.fromCssColorString(layer.fillColor ?? layer.color ?? "#0d6efd").withAlpha(layer.opacity ?? 0.2), markerColor: C.Color.fromCssColorString(layer.color ?? "#ef4444") }).then(result => {
          if (cancelled || viewer.isDestroyed()) { result.entities.removeAll(); return; }
          sources.push(result); void viewer.dataSources.add(result); viewer.scene.requestRender();
        }).catch(() => { if (!cancelled) setLayerError(true); });
      }
    }
    viewer.scene.requestRender();
    return () => { cancelled = true; removers.forEach(fn => fn()); if (!viewer.isDestroyed()) { raster.forEach(layer => viewer.imageryLayers.remove(layer, true)); sources.forEach(source => viewer.dataSources.remove(source, true)); } };
  }, [viewer, layers]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    viewer.entities.removeById("user-location"); viewer.entities.removeById("user-accuracy");
    if (location.latitude === null || location.longitude === null || !location.visible) { viewer.scene.requestRender(); return; }
    const position = C.Cartesian3.fromDegrees(location.longitude, location.latitude);
    viewer.entities.add({ id: "user-accuracy", position, ellipse: { semiMajorAxis: Math.max(1, location.accuracy ?? 1), semiMinorAxis: Math.max(1, location.accuracy ?? 1), material: C.Color.DODGERBLUE.withAlpha(0.15), heightReference: C.HeightReference.CLAMP_TO_GROUND } });
    viewer.entities.add({ id: "user-location", name: t("map.location.title"), position, point: { pixelSize: 14, color: C.Color.DODGERBLUE, outlineColor: C.Color.WHITE, outlineWidth: 3, heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Infinity }, label: { text: t("map.location.title"), font: "14px sans-serif", pixelOffset: new C.Cartesian2(0, -30), heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Infinity } });
    if (location.revision !== locationRevision.current) {
      locationRevision.current = location.revision;
      privateCamera.current = true;
      viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(location.longitude, location.latitude, Math.max(1000, (location.accuracy ?? 0) * 4)), duration: 1.2 });
    }
    viewer.scene.requestRender();
  }, [viewer, location.latitude, location.longitude, location.accuracy, location.visible, location.revision, t]);

  const toggle = (key: string, value: boolean) => writeGlobeQuery({ [key]: value });
  const back = () => { writeGlobeQuery({ view: "single" }, true); props.onViewChange?.("flat"); };
  const button = (key: string, icon: string, onClick: () => void) => <button type="button" title={t(`map.3d.${key}`)} aria-label={t(`map.3d.${key}`)} onClick={onClick}><i className={`bi bi-${icon}`} /></button>;
  return <div ref={shell} className={`savegeo-globe cesium-globe ${className ?? ""}`}>
    <div ref={container} id={id} className="savegeo-globe-canvas" aria-label={t("map.3d.title")} />
    {!viewer && !error && <div className="savegeo-globe-loading" role="status">{t("map.3d.loading")}</div>}
    {error ? <div className="savegeo-globe-error" role="alert">{t(`map.3d.${error}`)}<button type="button" onClick={back}>{t("map.3d.backTo2d")}</button></div> : showControls && <>
      <div className="globe-controls" role="toolbar" aria-label={t("map.3d.title")}>
        {button("home", "house", home)}{button("indonesia", "globe-asia-australia", indonesia)}
        {button("zoomIn", "plus-lg", () => viewer?.camera.zoomIn(Math.max(50, viewer.camera.positionCartographic.height * 0.4)))}
        {button("zoomOut", "dash-lg", () => viewer?.camera.zoomOut(Math.max(50, viewer.camera.positionCartographic.height * 0.4)))}
        {button("tilt", "box", () => { if (viewer) viewer.camera.lookUp(C.Math.toRadians(15)); })}
        {button("orbit", "arrow-clockwise", () => viewer?.camera.rotateRight(C.Math.toRadians(15)))}
        <button type="button" title={t("map.3d.compass")} aria-label={t("map.3d.compass")} onClick={() => viewer?.camera.setView({ orientation: { heading: 0, pitch: viewer.camera.pitch, roll: 0 } })}>N {heading}°</button>
        {button("fullscreen", "arrows-fullscreen", () => { void (document.fullscreenElement ? document.exitFullscreen() : shell.current?.requestFullscreen())?.catch(() => setError("fullscreenError")); })}
        {button("backTo2d", "map", back)}
      </div>
      <div className="globe-panels">
        <details className="globe-settings"><summary>{t("map.3d.basemap")}</summary><div className="globe-settings-body">
          <select aria-label={t("map.3d.basemap")} value={basemap?.id ?? ""} onChange={e => { writeGlobeQuery({ basemap: e.target.value }); props.onBasemapChange?.(e.target.value); }}>{basemaps.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <label><input type="checkbox" checked={terrain && terrainConfigured} disabled={!terrainConfigured} onChange={e => toggle("show_terrain", e.target.checked)} />{t("map.3d.terrain")}</label>
          <p role="status">{t(`map.3d.${terrainStatus}`)}</p>
          {terrainStatus === "terrainActive" && <label>{t("map.3d.exaggeration")} {exaggeration}×<input type="range" min="0.5" max="3" step="0.1" value={exaggeration} onChange={e => writeGlobeQuery({ terrain_exaggeration: e.target.value })} /></label>}
          <label><input type="checkbox" checked={buildings && buildingsConfigured} disabled={!buildingsConfigured} onChange={e => toggle("show_buildings", e.target.checked)} />{t("map.3d.buildings")}</label><p role="status">{t(`map.3d.${buildingStatus}`)}</p>
          <label><input type="checkbox" checked={showAoi} onChange={e => toggle("show_aoi", e.target.checked)} />AOI</label>
          <label><input type="checkbox" disabled={!basemap?.overlayUrl} checked={roads && Boolean(basemap?.overlayUrl)} onChange={e => toggle("show_roads", e.target.checked)} />{t("map.3d.roads")}</label>
          <label><input type="checkbox" disabled={!basemap?.labelsUrl} checked={labels && Boolean(basemap?.labelsUrl)} onChange={e => toggle("show_labels", e.target.checked)} />{t("map.3d.labels")}</label>
          <label><input type="checkbox" checked={lighting} onChange={e => toggle("show_lighting", e.target.checked)} />{t("map.3d.lighting")}</label>
        </div></details>
        <UserLocationControl />
      </div>
      <div className="globe-status" role="status">
        {!terrainConfigured && <span>{t("map.3d.terrainUnavailable")}</span>}
        {imageryError && <span>{t("map.3d.imageryError")}</span>}{layerError && <span>{t("map.3d.layerError")}</span>}
        {aoi && <span>{String(aoi.properties?.name ?? sharedAoi?.name ?? "AOI")}{sharedAoi?.areaKm2 != null ? ` · ${sharedAoi.areaKm2.toLocaleString()} km²` : ""}</span>}
        <span>{t("map.3d.gestures")}</span>
      </div>
    </>}
  </div>;
}
