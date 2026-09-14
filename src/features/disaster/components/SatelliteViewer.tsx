import { useEffect, useMemo, useState } from "react";
import { GeoJSON, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { nativeZoomForResolution } from "@/config/mapZoom";
import RasterResolutionNotice from "@/components/map/RasterResolutionNotice";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import { RESULT_PANE } from "@/config/mapPanes";
import { env } from "@/config/env";
import type {
  DisasterAoiRecord,
  DisasterAnalysisEntry,
  DisasterImageryGroup,
  DisasterPrimaryImagery,
  DisasterSatelliteLayers,
  HotspotRecord,
  SatelliteImageryRecord,
} from "../types";

type ViewMode = "pre" | "post" | "split" | "swipe";
const DISASTER_SCENE_MAX_ZOOM = 23;
const DISASTER_FIT_MAX_ZOOM = 18;

const AOI_STYLE = { color: "#1565c0", weight: 2, fill: false };
const HOTSPOT_STYLE = { color: "#e53935", weight: 2, fillOpacity: 0.25 };
const HOTSPOT_HIGHLIGHT_STYLE = { color: "#ffb300", weight: 4, fillOpacity: 0.35 };
const DISASTER_ANALYSIS_PANE = "disaster-analysis-pane";
const DISASTER_ANALYSIS_PANE_Z_INDEX = 370;

function FitToAoi({
  aoi,
  maxZoom = DISASTER_FIT_MAX_ZOOM,
}: {
  aoi: DisasterAoiRecord | null;
  maxZoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!aoi?.geojson) return;
    const bounds = L.geoJSON(aoi.geojson as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom });
  }, [aoi?.geojson, map, maxZoom]);
  return null;
}

function FitToFeature({
  feature,
  signal,
  maxZoom = DISASTER_FIT_MAX_ZOOM,
}: {
  feature: GeoJSON.Feature | GeoJSON.Geometry | null;
  signal: number;
  maxZoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!feature) return;
    const geom =
      feature.type === "Feature"
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

function nativeZoomForImagery(img: SatelliteImageryRecord | null): number {
  return nativeZoomForResolution(img?.resolution_m);
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
        .filter((entry) => checkedAnalyses.has(entry.model_id) && entry.result?.tile_url)
        .map((entry) => (
          <TileLayer
            key={`analysis-${entry.model_id}`}
            url={viewerUrl(entry.result!.tile_url)!}
            opacity={0.82}
            attribution={entry.user_label}
            pane={DISASTER_ANALYSIS_PANE}
          />
        ))}
      {showAoi && aoi?.geojson && (
        <GeoJSON
          key={`aoi-${aoi.id}`}
          data={aoi.geojson as GeoJSON.Feature}
          style={AOI_STYLE}
        />
      )}
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
  focusFeature?: GeoJSON.Feature | GeoJSON.Geometry | null;
  focusSignal?: number;
  showGlobeControl?: boolean;
}

/**
 * Item 2 of the redesign spec (D.2): before/after raw satellite comparison.
 * Reuses `SwipeCompareMap` directly for the Swipe mode, and reimplements
 * `lc-change/components/BeforeAfterMaps.tsx`'s split-view toggle pattern
 * (two independent `MapView`s) for Side-by-Side; Pre/Post-only render a
 * single `MapView` with one tile layer. Date pickers are plain dropdowns
 * populated only from `imagery.pre`/`imagery.post` (never a free date
 * input), per the contract doc.
 */
export default function SatelliteViewer({
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
  focusFeature = null,
  focusSignal = 0,
  showGlobeControl = true,
}: Props) {
  const [preId, setPreId] = useState<number | null>(
    primaryImagery.pre?.id ?? imagery.pre[0]?.id ?? null,
  );
  const [postId, setPostId] = useState<number | null>(
    primaryImagery.post?.id ?? imagery.post[0]?.id ?? null,
  );
  const [view, setView] = useState<ViewMode>("swipe");
  const [swipeOrientation, setSwipeOrientation] = useState<SwipeOrientation>("vertical");
  const [imageryOpacity, setImageryOpacity] = useState(0.9);

  const preImg = useMemo(
    () => imagery.pre.find((i) => i.id === preId) ?? null,
    [imagery.pre, preId],
  );
  const postImg = useMemo(
    () => imagery.post.find((i) => i.id === postId) ?? null,
    [imagery.post, postId],
  );
  const preTile = viewerTileUrl(preImg);
  const postTile = viewerTileUrl(postImg);
  const preNativeZoom = nativeZoomForImagery(preImg);
  const postNativeZoom = nativeZoomForImagery(postImg);

  if (!imagery.pre.length && !imagery.post.length) {
    return (
      <div className="alert alert-secondary py-2 mb-3">
        Belum ada citra satelit pre/post untuk event ini.
      </div>
    );
  }

  return (
    <div className="card mb-3 disaster-modern-card disaster-satellite-card">
      <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap disaster-soft-header">
        <span className="fw-semibold disaster-panel-title">
          <i className="bi bi-images" /> Citra Satelit
        </span>
        <div
          className="btn-group btn-group-sm ms-auto disaster-view-toggle"
          role="group"
          aria-label="Tampilan citra"
        >
          <button
            type="button"
            className={`btn btn-outline-secondary ${view === "pre" ? "active" : ""}`}
            onClick={() => setView("pre")}
          >
            Pre
          </button>
          <button
            type="button"
            className={`btn btn-outline-secondary ${view === "post" ? "active" : ""}`}
            onClick={() => setView("post")}
          >
            Post
          </button>
          <button
            type="button"
            className={`btn btn-outline-secondary ${view === "split" ? "active" : ""}`}
            onClick={() => setView("split")}
          >
            <i className="fas fa-columns" /> Berdampingan
          </button>
          <button
            type="button"
            className={`btn btn-outline-secondary ${view === "swipe" ? "active" : ""}`}
            onClick={() => setView("swipe")}
          >
            <i className="fas fa-arrows-alt-h" /> Geser
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="row g-2 mb-3 disaster-imagery-selectors">
          <div className="col-sm-6">
            <label className="form-label small fw-semibold mb-1">Citra Sebelum (Pre)</label>
            <select
              className="form-select form-select-sm"
              value={preId ?? ""}
              onChange={(e) => setPreId(e.target.value ? Number(e.target.value) : null)}
              disabled={!imagery.pre.length}
            >
              {!imagery.pre.length && <option value="">Tidak tersedia</option>}
              {imagery.pre.map((img) => (
                <option key={img.id} value={img.id}>
                  {imageryLabel(img)}
                  {img.is_primary ? " (utama)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-6">
            <label className="form-label small fw-semibold mb-1">Citra Sesudah (Post)</label>
            <select
              className="form-select form-select-sm"
              value={postId ?? ""}
              onChange={(e) => setPostId(e.target.value ? Number(e.target.value) : null)}
              disabled={!imagery.post.length}
            >
              {!imagery.post.length && <option value="">Tidak tersedia</option>}
              {imagery.post.map((img) => (
                <option key={img.id} value={img.id}>
                  {imageryLabel(img)}
                  {img.is_primary ? " (utama)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(view === "pre" || view === "post") && (
          <MapView id={`disasterSatMap-${view}`} showGlobeControl={showGlobeControl}>
            <BasemapSwitcher />
            <LayerOpacityControl
              opacity={imageryOpacity}
              onChange={setImageryOpacity}
              label="Opacity citra"
            />
            {view === "pre" && preTile && (
              <TileLayer
                url={preTile}
                opacity={imageryOpacity}
                attribution="Google Earth Engine"
                crossOrigin={preImg?.source_kind === "local_upload" ? "use-credentials" : undefined}
                pane={RESULT_PANE}
                maxNativeZoom={preNativeZoom}
                maxZoom={DISASTER_SCENE_MAX_ZOOM}
              />
            )}
            {view === "post" && postTile && (
              <TileLayer
                url={postTile}
                opacity={imageryOpacity}
                attribution="Google Earth Engine"
                crossOrigin={postImg?.source_kind === "local_upload" ? "use-credentials" : undefined}
                pane={RESULT_PANE}
                maxNativeZoom={postNativeZoom}
                maxZoom={DISASTER_SCENE_MAX_ZOOM}
              />
            )}
            <ViewerLayers
              aoi={aoi}
              showAoi={showAoi}
              satellite={satellite}
              showSatellite={showSatellite}
              analyses={analyses}
              checkedAnalyses={checkedAnalyses}
              hotspots={hotspots}
              showHotspots={showHotspots}
              highlightedHotspotId={highlightedHotspotId}
              onHotspotClick={onHotspotClick}
            />
            <RasterResolutionNotice layers={[view === "pre" ? {label: "Pre", resolutionM: preImg?.resolution_m, nativeZoom: preNativeZoom} : {label: "Post", resolutionM: postImg?.resolution_m, nativeZoom: postNativeZoom}]} />
                <FitToAoi aoi={aoi} />
            <FitToFeature feature={focusFeature} signal={focusSignal} />
          </MapView>
        )}

        {view === "split" && (
          <div className="row g-2">
            <div className="col-md-6">
              <MapView id="disasterSatMapPre" showGlobeControl={showGlobeControl}>
                <BasemapSwitcher />
                <LayerOpacityControl
                  opacity={imageryOpacity}
                  onChange={setImageryOpacity}
                  label="Opacity citra"
                />
                {preTile && (
                  <TileLayer
                    url={preTile}
                    opacity={imageryOpacity}
                    attribution="Google Earth Engine"
                    crossOrigin={preImg?.source_kind === "local_upload" ? "use-credentials" : undefined}
                    pane={RESULT_PANE}
                    maxNativeZoom={preNativeZoom}
                    maxZoom={DISASTER_SCENE_MAX_ZOOM}
                  />
                )}
                <ViewerLayers
                  aoi={aoi}
                  showAoi={showAoi}
                  satellite={satellite}
                  showSatellite={showSatellite}
                  analyses={analyses}
                  checkedAnalyses={checkedAnalyses}
                  hotspots={hotspots}
                  showHotspots={showHotspots}
                  highlightedHotspotId={highlightedHotspotId}
                  onHotspotClick={onHotspotClick}
                />
                <RasterResolutionNotice layers={[{label: "Pre", resolutionM: preImg?.resolution_m, nativeZoom: preNativeZoom}]} />
                <FitToAoi aoi={aoi} />
                <FitToFeature feature={focusFeature} signal={focusSignal} />
              </MapView>
              <div className="text-center small text-muted mt-1">
                Sebelum {preImg ? `· ${preImg.acquisition_date}` : ""}
              </div>
            </div>
            <div className="col-md-6">
              <MapView id="disasterSatMapPost" showGlobeControl={false}>
                <BasemapSwitcher />
                <LayerOpacityControl
                  opacity={imageryOpacity}
                  onChange={setImageryOpacity}
                  label="Opacity citra"
                />
                {postTile && (
                  <TileLayer
                    url={postTile}
                    opacity={imageryOpacity}
                    attribution="Google Earth Engine"
                    crossOrigin={postImg?.source_kind === "local_upload" ? "use-credentials" : undefined}
                    pane={RESULT_PANE}
                    maxNativeZoom={postNativeZoom}
                    maxZoom={DISASTER_SCENE_MAX_ZOOM}
                  />
                )}
                <ViewerLayers
                  aoi={aoi}
                  showAoi={showAoi}
                  satellite={satellite}
                  showSatellite={showSatellite}
                  analyses={analyses}
                  checkedAnalyses={checkedAnalyses}
                  hotspots={hotspots}
                  showHotspots={showHotspots}
                  highlightedHotspotId={highlightedHotspotId}
                  onHotspotClick={onHotspotClick}
                />
                <RasterResolutionNotice layers={[{label: "Post", resolutionM: postImg?.resolution_m, nativeZoom: postNativeZoom}]} />
                <FitToAoi aoi={aoi} />
                <FitToFeature feature={focusFeature} signal={focusSignal} />
              </MapView>
              <div className="text-center small text-muted mt-1">
                Sesudah {postImg ? `· ${postImg.acquisition_date}` : ""}
              </div>
            </div>
          </div>
        )}

        {view === "swipe" && (
          <SwipeCompareMap
            id="disasterSatSwipeMap"
            beforeUrl={preTile}
            afterUrl={postTile}
            beforeLabel={`Sebelum${preImg ? ` · ${preImg.acquisition_date}` : ""}`}
            afterLabel={`Sesudah${postImg ? ` · ${postImg.acquisition_date}` : ""}`}
            orientation={swipeOrientation}
            beforeCrossOrigin={preImg?.source_kind === "local_upload" ? "use-credentials" : undefined}
            afterCrossOrigin={postImg?.source_kind === "local_upload" ? "use-credentials" : undefined}
            onOrientationChange={setSwipeOrientation}
            opacity={imageryOpacity}
            maxZoom={DISASTER_SCENE_MAX_ZOOM}
            beforeResolutionM={preImg?.resolution_m ?? undefined}
            afterResolutionM={postImg?.resolution_m ?? undefined}
            beforeMaxNativeZoom={preNativeZoom}
            afterMaxNativeZoom={postNativeZoom}
            showGlobeControl={showGlobeControl}
            initialPercent={35}
            bounds={aoi?.geojson ? L.geoJSON(aoi.geojson as GeoJSON.Feature).getBounds() : undefined}
            clipGeometry={aoi?.geojson as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null}
          >
            <LayerOpacityControl
              opacity={imageryOpacity}
              onChange={setImageryOpacity}
              label="Opacity citra"
            />
            <ViewerLayers
              aoi={aoi}
              showAoi={showAoi}
              satellite={satellite}
              showSatellite={showSatellite}
              analyses={analyses}
              checkedAnalyses={checkedAnalyses}
              hotspots={hotspots}
              showHotspots={showHotspots}
              highlightedHotspotId={highlightedHotspotId}
              onHotspotClick={onHotspotClick}
            />
            <FitToAoi aoi={aoi} />
            <FitToFeature feature={focusFeature} signal={focusSignal} />
          </SwipeCompareMap>
        )}
      </div>
    </div>
  );
}
