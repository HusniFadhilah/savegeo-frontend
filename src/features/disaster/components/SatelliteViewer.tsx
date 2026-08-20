import { useEffect, useMemo, useState } from "react";
import { GeoJSON, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import { RESULT_PANE } from "@/config/mapPanes";
import type { DisasterAoiRecord, DisasterImageryGroup, DisasterPrimaryImagery, SatelliteImageryRecord } from "../types";

type ViewMode = "pre" | "post" | "split" | "swipe";

const AOI_STYLE = { color: "#1565c0", weight: 2, fill: false };

function FitToAoi({ aoi }: { aoi: DisasterAoiRecord | null }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi?.geojson) return;
    const bounds = L.geoJSON(aoi.geojson as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aoi?.id]);
  return null;
}

function imageryLabel(img: SatelliteImageryRecord): string {
  return `${img.satellite} · ${img.acquisition_date}`;
}

interface Props {
  aoi: DisasterAoiRecord | null;
  imagery: DisasterImageryGroup;
  primaryImagery: DisasterPrimaryImagery;
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
export default function SatelliteViewer({ aoi, imagery, primaryImagery }: Props) {
  const [preId, setPreId] = useState<number | null>(primaryImagery.pre?.id ?? imagery.pre[0]?.id ?? null);
  const [postId, setPostId] = useState<number | null>(primaryImagery.post?.id ?? imagery.post[0]?.id ?? null);
  const [view, setView] = useState<ViewMode>("swipe");
  const [swipeOrientation, setSwipeOrientation] = useState<SwipeOrientation>("vertical");

  const preImg = useMemo(() => imagery.pre.find((i) => i.id === preId) ?? null, [imagery.pre, preId]);
  const postImg = useMemo(() => imagery.post.find((i) => i.id === postId) ?? null, [imagery.post, postId]);
  const preTile = preImg?.preview_tile_url ?? null;
  const postTile = postImg?.preview_tile_url ?? null;

  if (!imagery.pre.length && !imagery.post.length) {
    return <div className="alert alert-secondary py-2 mb-3">Belum ada citra satelit pre/post untuk event ini.</div>;
  }

  return (
    <div className="card mb-3">
      <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap">
        <span className="fw-semibold">
          <i className="bi bi-images" /> Citra Satelit
        </span>
        <div className="btn-group btn-group-sm ms-auto" role="group" aria-label="Tampilan citra">
          <button type="button" className={`btn btn-outline-secondary ${view === "pre" ? "active" : ""}`} onClick={() => setView("pre")}>
            Pre
          </button>
          <button type="button" className={`btn btn-outline-secondary ${view === "post" ? "active" : ""}`} onClick={() => setView("post")}>
            Post
          </button>
          <button type="button" className={`btn btn-outline-secondary ${view === "split" ? "active" : ""}`} onClick={() => setView("split")}>
            <i className="fas fa-columns" /> Berdampingan
          </button>
          <button type="button" className={`btn btn-outline-secondary ${view === "swipe" ? "active" : ""}`} onClick={() => setView("swipe")}>
            <i className="fas fa-arrows-alt-h" /> Geser
          </button>
        </div>
      </div>
      <div className="card-body">
        <div className="row g-2 mb-2">
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
          <MapView id={`disasterSatMap-${view}`}>
            <BasemapSwitcher />
            {view === "pre" && preTile && <TileLayer url={preTile} opacity={0.9} attribution="Google Earth Engine" pane={RESULT_PANE} />}
            {view === "post" && postTile && <TileLayer url={postTile} opacity={0.9} attribution="Google Earth Engine" pane={RESULT_PANE} />}
            {aoi?.geojson && <GeoJSON key={`aoi-${aoi.id}`} data={aoi.geojson as GeoJSON.Feature} style={AOI_STYLE} />}
            <FitToAoi aoi={aoi} />
          </MapView>
        )}

        {view === "split" && (
          <div className="row g-2">
            <div className="col-md-6">
              <MapView id="disasterSatMapPre">
                <BasemapSwitcher />
                {preTile && <TileLayer url={preTile} opacity={0.9} attribution="Google Earth Engine" pane={RESULT_PANE} />}
                {aoi?.geojson && <GeoJSON key={`aoi-pre-${aoi.id}`} data={aoi.geojson as GeoJSON.Feature} style={AOI_STYLE} />}
                <FitToAoi aoi={aoi} />
              </MapView>
              <div className="text-center small text-muted mt-1">Sebelum {preImg ? `· ${preImg.acquisition_date}` : ""}</div>
            </div>
            <div className="col-md-6">
              <MapView id="disasterSatMapPost">
                <BasemapSwitcher />
                {postTile && <TileLayer url={postTile} opacity={0.9} attribution="Google Earth Engine" pane={RESULT_PANE} />}
                {aoi?.geojson && <GeoJSON key={`aoi-post-${aoi.id}`} data={aoi.geojson as GeoJSON.Feature} style={AOI_STYLE} />}
                <FitToAoi aoi={aoi} />
              </MapView>
              <div className="text-center small text-muted mt-1">Sesudah {postImg ? `· ${postImg.acquisition_date}` : ""}</div>
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
            onOrientationChange={setSwipeOrientation}
          >
            {aoi?.geojson && <GeoJSON key={`aoi-swipe-${aoi.id}`} data={aoi.geojson as GeoJSON.Feature} style={AOI_STYLE} />}
            <FitToAoi aoi={aoi} />
          </SwipeCompareMap>
        )}
      </div>
    </div>
  );
}
