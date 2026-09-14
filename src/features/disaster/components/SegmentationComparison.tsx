import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import { nativeZoomForResolution } from "@/config/mapZoom";
import { RESULT_PANE } from "@/config/mapPanes";

export interface SegmentationResult {
  model_id: string; model_version: string; method: string;
  result_semantics?: "land_cover" | "change_indicator" | "water_extent" | string;
  damage_model?: boolean;
  validation_status?: string;
  limitations?: string[];
  review_reasons?: string[];
  aoi: GeoJSON.Polygon | GeoJSON.MultiPolygon; resolution_m: number; crs: string;
  pre_tile_url: string; post_tile_url: string; change_tile_url: string;
  confidence_tile_url?: string | null;
  pre: {date: string; scene_count: number; algorithm_versions?: string[]; qa_versions?: string[]}; post: {date: string; scene_count: number; algorithm_versions?: string[]; qa_versions?: string[]};
  aoi_area_ha: number; valid_area_ha: number; no_data_area_ha: number;
  changed_area_ha: number; unchanged_area_ha: number; coverage_note: string;
  classes: Array<{class_id: number; label: string; color: string; pre_area_ha: number; post_area_ha: number;
    change_area_ha: number; pre_percentage: number; post_percentage: number; pre_pixel_count: number; post_pixel_count: number;
    pre_confidence: number | null; post_confidence: number | null;
    gained_area_ha?: number; lost_area_ha?: number; unchanged_area_ha?: number}>;
  transitions: Array<{pre_class_id: number; post_class_id: number; area_ha: number; label: string; color: string}>;
}
const number = (value: number) => value.toLocaleString("id-ID", {maximumFractionDigits: 2});
const modes = {pre: "Pre", post: "Post", split: "Berdampingan", swipe: "Geser", change: "Perubahan", classes: "Segmentasi multi-kelas"};

function MapSetup({aoi, maps}: {aoi: GeoJSON.Geometry; maps: React.MutableRefObject<Set<L.Map>>}) {
  const map = useMap();
  useEffect(() => {
    const registeredMaps = maps.current;
    const bounds = L.geoJSON(aoi).getBounds();
    const peer = [...registeredMaps][0];
    if (peer) map.setView(peer.getCenter(), peer.getZoom(), {animate: false});
    else if (bounds.isValid()) map.fitBounds(bounds, {padding: [15, 15], maxZoom: 14});
    registeredMaps.add(map);
    const sync = () => {
      map.getContainer().dataset.mapCenter = JSON.stringify([map.getCenter().lat, map.getCenter().lng]);
      map.getContainer().dataset.mapZoom = String(map.getZoom());
      for (const other of registeredMaps) {
        if (other !== map && (!other.getCenter().equals(map.getCenter()) || other.getZoom() !== map.getZoom()))
          other.setView(map.getCenter(), map.getZoom(), {animate: false});
      }
    };
    sync();
    map.on("moveend", sync);
    return () => {map.off("moveend", sync); registeredMaps.delete(map);};
  }, [aoi, map, maps]);
  return <GeoJSON data={aoi} style={{color: "#172554", weight: 2, fill: false}} />;
}

/** Uses stored outputs only: changing a mode or divider never requests analysis. */
export default function SegmentationComparison({result}: {result: SegmentationResult}) {
  const [mode, setMode] = useState<keyof typeof modes>("swipe");
  const [orientation, setOrientation] = useState<SwipeOrientation>("vertical");
  const [opacity, setOpacity] = useState(1);
  const [tileError, setTileError] = useState(false);
  const maps = useRef(new Set<L.Map>());
  const bounds = useMemo(() => L.geoJSON(result.aoi).getBounds(), [result.aoi]);
  const clipGeometry = useMemo(() => ({type: "Feature" as const, properties: {}, geometry: result.aoi}), [result.aoi]);
  const nativeZoom = nativeZoomForResolution(result.resolution_m);
  if (!result.pre_tile_url || !result.post_tile_url || !result.classes.length)
    return <div role="alert" className="alert alert-warning">Hasil pre/post atau kelas belum tersedia. Jalankan analisis lengkap.</div>;
  const single = (phase: "pre" | "post" | "change") => <MapView id={`segmentation-${phase}`}>
    <BasemapSwitcher />
    <TileLayer key={result[`${phase}_tile_url`]} url={result[`${phase}_tile_url`]} bounds={bounds}
      pane={RESULT_PANE} opacity={opacity} maxNativeZoom={nativeZoom} maxZoom={22}
      eventHandlers={{tileerror: () => setTileError(true)}} />
    <MapSetup aoi={result.aoi} maps={maps} />
  </MapView>;
  return <section className="card p-3 mb-3 segmentation-comparison" aria-label="Perbandingan segmentasi">
    <strong>Segmentasi pre/post · {result.model_id} v{result.model_version}</strong>
    {result.damage_model === false && <div className="alert alert-info mt-2 mb-2" role="status">
      <strong>Proksi tutupan lahan.</strong> Model ini tidak dilatih untuk kelas kerusakan bencana. Perubahan pre/post hanya menunjukkan perubahan kelas Dynamic World dan tidak boleh diberi label sebagai area terbakar, longsor, tsunami, atau kerusakan bangunan.
      {result.limitations?.length ? <ul className="mb-0 mt-1">{result.limitations.map(item => <li key={item}>{item}</li>)}</ul> : null}
    </div>}
    <p className="small text-muted">{result.method}</p>
    {result.review_reasons?.map(reason => <div key={reason} className="alert alert-warning" role="status">{reason}</div>)}
    <div className="small mb-2">{result.pre.date} ({result.pre.scene_count} scene) → {result.post.date} ({result.post.scene_count} scene) · {result.resolution_m} m · {result.crs}</div>
    {result.pre.algorithm_versions && <div className="small mb-2">Versi inferensi: {result.pre.algorithm_versions.join(", ")} · Versi masking: {result.pre.qa_versions?.join(", ")}</div>}
    <div className="d-flex flex-wrap gap-2 mb-2" role="group" aria-label="Mode segmentasi">
      {Object.entries(modes).map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key}
        className={`btn btn-sm ${mode === key ? "btn-primary" : "btn-outline-primary"}`}
        onClick={() => {setMode(key as keyof typeof modes); setTileError(false);}}>{label}</button>)}
      <label className="small">Opacity <input aria-label="Opacity segmentasi" type="range" min="0" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>
    </div>
    {tileError && <div role="alert" className="alert alert-danger">Tile segmentasi gagal dimuat. URL mungkin kedaluwarsa; jalankan ulang analisis untuk memperbarui hasil.</div>}
    {mode === "swipe" ? <SwipeCompareMap id="segmentation-swipe" beforeUrl={result.pre_tile_url} afterUrl={result.post_tile_url}
      beforeLabel="Segmentasi pre" afterLabel="Segmentasi post" orientation={orientation} onOrientationChange={setOrientation}
      opacity={opacity} bounds={bounds} clipGeometry={clipGeometry}
      beforeMaxNativeZoom={nativeZoom} afterMaxNativeZoom={nativeZoom} beforeResolutionM={result.resolution_m} afterResolutionM={result.resolution_m}>
      <MapSetup aoi={result.aoi} maps={maps} />
    </SwipeCompareMap> : mode === "split" ? <div className="row g-2"><div className="col-md-6"><strong>Pre</strong>{single("pre")}</div><div className="col-md-6"><strong>Post</strong>{single("post")}</div></div>
      : single(mode === "pre" ? "pre" : mode === "change" ? "change" : "post")}
    {mode === "change" && result.changed_area_ha === 0 && <p>Tidak ada perubahan kelas pada piksel valid bersama.</p>}
    <p className="small mt-2">{result.coverage_note} Luas AOI: {number(result.aoi_area_ha)} ha; valid bersama: {number(result.valid_area_ha)} ha; no-data: {number(result.no_data_area_ha)} ha. Berubah: {number(result.changed_area_ha)} ha; tetap: {number(result.unchanged_area_ha)} ha.</p>
    <div className="table-responsive"><table className="table table-sm" aria-label="Statistik kelas segmentasi"><thead><tr><th>Kelas</th><th>Pre ha / %</th><th>Post ha / %</th><th>Selisih ha</th><th>Piksel pre / post</th><th>Probabilitas pre / post</th></tr></thead>
      <tbody>{result.classes.map(c => <tr key={c.class_id}><td><span style={{background: c.color, display: "inline-block", width: 12, height: 12, marginRight: 5}} />{c.label}</td>
        <td>{number(c.pre_area_ha)} / {number(c.pre_percentage)}%</td><td>{number(c.post_area_ha)} / {number(c.post_percentage)}%</td><td>{number(c.change_area_ha)}</td>
        <td>{c.pre_pixel_count} / {c.post_pixel_count}</td><td>{c.pre_confidence == null ? "—" : number(c.pre_confidence)} / {c.post_confidence == null ? "—" : number(c.post_confidence)}</td></tr>)}</tbody></table></div>
    {mode === "change" && <>
      <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Kelas</th><th>Bertambah ha</th><th>Berkurang ha</th><th>Tetap ha</th></tr></thead><tbody>
        {result.classes.map(c => <tr key={c.class_id}><td>{c.label}</td><td>{c.gained_area_ha == null ? "—" : number(c.gained_area_ha)}</td><td>{c.lost_area_ha == null ? "—" : number(c.lost_area_ha)}</td><td>{c.unchanged_area_ha == null ? "—" : number(c.unchanged_area_ha)}</td></tr>)}
      </tbody></table></div>
      <ul>{result.transitions.filter(t => t.pre_class_id !== t.post_class_id).map(t => <li key={`${t.pre_class_id}-${t.post_class_id}`}>{t.label}: {number(t.area_ha)} ha</li>)}</ul>
    </>}
    <small className="text-muted">This dataset is produced for the Dynamic World Project by Google in partnership with National Geographic Society and the World Resources Institute. Contains modified Copernicus Sentinel data. <a href="https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1" target="_blank" rel="noreferrer">Sumber dan lisensi</a></small>
  </section>;
}
