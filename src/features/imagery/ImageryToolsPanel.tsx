import { useEffect, useMemo, useState } from "react";
import { TileLayer } from "react-leaflet";
import type { AoiFeature } from "@/types/map";
import type { FeatureCollection } from "geojson";
import { getNasaGibsLayers, runRasterToolbox } from "./api";
import type { ImageryScene } from "./types";

const NASA_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg";
const OVERTURE_RELEASE = "2026-08-19.0";

export default function ImageryToolsPanel({ scene, aoi, assetKey, onNasaLayer, onStory, mapMode = "flat", onMapMode }: {
  scene: ImageryScene | null; aoi: AoiFeature | null; assetKey: string;
  onNasaLayer: (url: string | null) => void; onStory: (story: FeatureCollection) => void;
  mapMode?: "flat" | "globe"; onMapMode?: (mode: "flat" | "globe") => void;
}) {
  const [layers, setLayers] = useState<{ id: string; name: string }[]>([]);
  const [nasaLayer, setNasaLayer] = useState("");
  const [nasaDate, setNasaDate] = useState(new Date().toISOString().slice(0, 10));
  const [operation, setOperation] = useState("stretch");
  const [bands, setBands] = useState("1,2,3");
  const [toolbox, setToolbox] = useState<{ stats: { min: number; mean: number; max: number }; histogram: number[]; bins: number[]; download_url?: string } | null>(null);
  const [storyTitle, setStoryTitle] = useState("Cerita Scene Satelit");
  const [storyText, setStoryText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { getNasaGibsLayers().then((response) => { setLayers(response.layers); setNasaLayer(response.layers[0]?.id ?? ""); }).catch(() => setMessage("Layer NASA GIBS belum dapat dimuat.")); }, []);
  const nasaUrl = useMemo(() => nasaLayer ? NASA_WMTS.replace("{layer}", nasaLayer).replace("{time}", nasaDate) : null, [nasaDate, nasaLayer]);
  async function execute(exportRaster = false) {
    if (!scene || !aoi) return;
    setBusy(true); setMessage("");
    try {
      const result = await runRasterToolbox({ itemUrl: scene.id, assetKey, aoi, operation, bands, export: exportRaster });
      setToolbox(result); if (result.download_url) setMessage("Raster berhasil diekspor.");
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }
  function saveStory() {
    if (!scene || !aoi) return;
    onStory({ type: "FeatureCollection", features: [{ type: "Feature", geometry: aoi.geometry, properties: {
      title: storyTitle, narrative: storyText, scene_id: scene.id, acquired_at: scene.acquired_at,
    } }] });
    setMessage("Story Map disiapkan dari scene dan AOI aktif.");
  }
  return <div className="mt-3">
    <div className="card mb-3"><div className="card-header py-2"><i className="bi bi-tools" /> Raster Toolbox Ringan</div><div className="card-body">
      <div className="row g-2"><div className="col-md-4"><select className="form-select form-select-sm" value={operation} onChange={(e) => setOperation(e.target.value)}><option value="stretch">Clip + Stretch</option><option value="ndvi">NDVI</option><option value="ndwi">NDWI</option><option value="band_math">Band Math</option></select></div><div className="col-md-4"><input className="form-control form-control-sm" value={bands} onChange={(e) => setBands(e.target.value)} placeholder="Band 1,2,3" /></div><div className="col-md-4 d-flex gap-2"><button className="btn btn-sm btn-primary flex-fill" disabled={!scene || !aoi || busy} onClick={() => void execute()}><i className="bi bi-calculator" /> Hitung</button><button className="btn btn-sm btn-outline-success" disabled={!toolbox || busy} onClick={() => void execute(true)} title="Export GeoTIFF"><i className="bi bi-download" /></button></div></div>
      {toolbox && <div className="small mt-2">Min {toolbox.stats.min.toFixed(3)} · Mean {toolbox.stats.mean.toFixed(3)} · Max {toolbox.stats.max.toFixed(3)}<div className="d-flex align-items-end gap-1 mt-2" style={{ height: 44 }}>{toolbox.histogram.map((value, index) => <span key={index} style={{ height: `${Math.max(3, value / Math.max(...toolbox.histogram) * 100)}%`, flex: 1, background: "#2f9e72" }} title={`${toolbox.bins[index]?.toFixed(2)}: ${value}`} />)}</div>{toolbox.download_url && <a className="small" href={toolbox.download_url} download>Download GeoTIFF hasil</a>}</div>}
      {message && <div className="small text-muted mt-2">{message}</div>}
    </div></div>
    <div className="card mb-3"><div className="card-header py-2"><i className="bi bi-globe-americas" /> NASA GIBS / Earthdata Time Layer</div><div className="card-body"><div className="row g-2"><div className="col-md-5"><select className="form-select form-select-sm" value={nasaLayer} onChange={(e) => setNasaLayer(e.target.value)}>{layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</select></div><div className="col-md-4"><input type="date" className="form-control form-control-sm" value={nasaDate} onChange={(e) => setNasaDate(e.target.value)} /></div><div className="col-md-3"><button className="btn btn-sm btn-outline-primary w-100" onClick={() => onNasaLayer(nasaUrl)}>{nasaUrl ? "Tampilkan" : "Pilih layer"}</button></div></div><small className="text-muted d-block mt-2">Layer harian NASA GIBS dapat dibandingkan dengan scene aktif.</small></div></div>
    <div className="card mb-3"><div className="card-header py-2"><i className="bi bi-buildings" /> Overture Maps</div><div className="card-body small">Data Overture tersedia sebagai PMTiles resmi. <a href={`https://pmtiles.io/?url=https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${OVERTURE_RELEASE}/base.pmtiles`} target="_blank" rel="noreferrer">Buka Explorer Overture</a><div className="mt-1"><a href="https://docs.overturemaps.org/getting-data/cloud-sources/" target="_blank" rel="noreferrer">Katalog dan tema Overture</a></div></div></div>
    <div className="card mb-3"><div className="card-header py-2"><i className="bi bi-globe2" /> Mode Peta</div><div className="card-body"><div className="btn-group btn-group-sm w-100"><button className={`btn ${mapMode === "flat" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => onMapMode?.("flat")}><i className="bi bi-map" /> Flat map</button><button className={`btn ${mapMode === "globe" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => onMapMode?.("globe")}><i className="bi bi-globe-americas" /> Globe</button></div></div></div>
    <div className="card"><div className="card-header py-2"><i className="bi bi-book-half" /> Story Map</div><div className="card-body"><input className="form-control form-control-sm mb-2" value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} placeholder="Judul cerita" /><textarea className="form-control form-control-sm mb-2" rows={3} value={storyText} onChange={(e) => setStoryText(e.target.value)} placeholder="Narasi scene, perubahan, atau temuan..." /><button className="btn btn-sm btn-outline-success" disabled={!scene || !aoi} onClick={saveStory}><i className="bi bi-bookmark-plus" /> Tambahkan scene ke Story Map</button></div></div>
  </div>;
}
