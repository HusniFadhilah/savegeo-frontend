import { useEffect, useMemo, useState } from "react";
import { GeoJSON } from "react-leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import { ApiError } from "@/services/apiClient";
import { fetchSamGeoCapabilities, fetchSamGeoJob, startSamGeoSegmentation } from "../api";
import type { DisasterAoiRecord, SatelliteImageryRecord, SamGeoCapabilities, SamGeoClass, SamGeoJob, SamGeoMode } from "../types";

interface Props {
  aoi: DisasterAoiRecord | null;
  imagery: { pre: SatelliteImageryRecord[]; post: SatelliteImageryRecord[] };
}

const CLASS_OPTIONS: { value: SamGeoClass; label: string }[] = [
  { value: "building", label: "Building" },
  { value: "road", label: "Road" },
  { value: "water", label: "Water" },
  { value: "tree", label: "Tree" },
  { value: "crop", label: "Crop" },
  { value: "bare_land", label: "Bare land" },
  { value: "custom_prompt", label: "Custom prompt" },
];

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Segmentasi gagal";
}

function downloadGeoJson(features: GeoJSON.FeatureCollection) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(features, null, 2)], { type: "application/geo+json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "savegeo-segmentation-candidate.geojson";
  link.click();
  URL.revokeObjectURL(url);
}

export default function SamGeoSegmentationPanel({ aoi, imagery }: Props) {
  const [capabilities, setCapabilities] = useState<SamGeoCapabilities | null>(null);
  const [mode, setMode] = useState<SamGeoMode>("automatic");
  const [classLabel, setClassLabel] = useState<SamGeoClass>("building");
  const [prompt, setPrompt] = useState("");
  const [imageryId, setImageryId] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [upload, setUpload] = useState<File | undefined>();
  const [confidence, setConfidence] = useState(0.5);
  const [job, setJob] = useState<SamGeoJob | null>(null);
  const [features, setFeatures] = useState<GeoJSON.FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedImagery = useMemo(() => [...imagery.pre, ...imagery.post].find((entry) => String(entry.id) === imageryId), [imagery, imageryId]);

  useEffect(() => {
    fetchSamGeoCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
  }, []);

  useEffect(() => {
    if (!job?.job_id || job.status !== "running") return;
    const timer = window.setTimeout(() => {
      fetchSamGeoJob(job.job_id).then(setJob).catch((err) => setError(message(err)));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [job]);

  useEffect(() => {
    if (job?.result) setFeatures(job.result);
  }, [job]);

  const start = async () => {
    if (!aoi?.geojson) return setError("AOI belum tersedia");
    if (!upload && !itemUrl.trim()) return setError("Pilih GeoTIFF/COG atau isi URL scene");
    if (mode === "prompt_based" && classLabel === "custom_prompt" && !prompt.trim()) return setError("Isi custom prompt");
    setError(null);
    setFeatures(null);
    try {
      const result = await startSamGeoSegmentation({
        item_url: upload ? undefined : itemUrl.trim(),
        file: upload,
        aoi: aoi.geojson,
        mode,
        class_label: classLabel,
        prompt: mode === "prompt_based" ? (classLabel === "custom_prompt" ? prompt.trim() : classLabel) : undefined,
        confidence_threshold: confidence,
      });
      setJob(result);
    } catch (err) {
      setError(message(err));
    }
  };

  const deleteFeature = (index: number) => {
    setFeatures((current) => current ? { ...current, features: current.features.filter((_, featureIndex) => featureIndex !== index) } : current);
  };

  const editFeatureLabel = (index: number, value: string) => {
    setFeatures((current) => {
      if (!current) return current;
      return { ...current, features: current.features.map((feature, featureIndex) => featureIndex === index ? { ...feature, properties: { ...(feature.properties ?? {}), class_label: value } } : feature) };
    });
  };

  return (
    <div className="card mt-3 disaster-modern-card">
      <div className="card-header py-2 disaster-soft-header"><i className="bi bi-magic me-1" /> Interactive SamGeo segmentation</div>
      <div className="card-body">
        <div className="alert alert-warning py-2 small">Hasil segmentasi adalah kandidat dan berstatus review_required. Jangan menafsirkannya sebagai kerusakan terkonfirmasi.</div>
        {!capabilities?.available && <div className="text-muted small mb-2">Runtime SamGeo belum tersedia pada server.</div>}
        <div className="row g-2">
          <div className="col-md-3"><label className="form-label small">Imagery pre/post</label><select className="form-select form-select-sm" value={imageryId} onChange={(event) => setImageryId(event.target.value)}><option value="">Upload/URL manual</option>{[...imagery.pre, ...imagery.post].map((entry) => <option key={entry.id} value={entry.id}>{entry.phase} · {entry.satellite} · {entry.acquisition_date}</option>)}</select></div>
          <div className="col-md-3"><label className="form-label small">GeoTIFF/COG upload</label><input className="form-control form-control-sm" type="file" accept=".tif,.tiff" onChange={(event) => setUpload(event.target.files?.[0])} /></div>
          <div className="col-md-3"><label className="form-label small">COG URL</label><input className="form-control form-control-sm" value={itemUrl} onChange={(event) => setItemUrl(event.target.value)} placeholder={selectedImagery?.data_source ?? "https://..."} /></div>
          <div className="col-md-3"><label className="form-label small">Mode</label><select className="form-select form-select-sm" value={mode} onChange={(event) => setMode(event.target.value as SamGeoMode)}><option value="automatic">Automatic</option><option value="prompt_based">Prompt-based</option></select></div>
        </div>
        {mode === "prompt_based" && <div className="row g-2 mt-1"><div className="col-md-4"><label className="form-label small">Kelas</label><select className="form-select form-select-sm" value={classLabel} onChange={(event) => setClassLabel(event.target.value as SamGeoClass)}>{CLASS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="col-md-4"><label className="form-label small">Custom prompt</label><input className="form-control form-control-sm" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={classLabel !== "custom_prompt"} placeholder="e.g. damaged buildings" /></div><div className="col-md-4"><label className="form-label small">Confidence: {confidence.toFixed(2)}</label><input className="form-range" type="range" min="0" max="1" step="0.05" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></div></div>}
        {error && <div className="alert alert-danger py-1 px-2 small mt-2">{error}</div>}
        <div className="d-flex gap-2 mt-2"><button type="button" className="btn btn-sm btn-primary" onClick={start} disabled={job?.status === "running" || !aoi}>{job?.status === "running" ? "Memproses…" : "Segment"}</button>{features && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => downloadGeoJson(features)}>Export GeoJSON</button>}</div>
        {job?.status === "running" && <div className="small text-muted mt-2" role="status">Job {job.job_id} sedang diproses…</div>}
        {features && <><div className="small text-muted mt-2">{features.features.length} polygon kandidat · confidence {confidence.toFixed(2)} · review_required</div><div className="row g-2 mt-1"><div className="col-lg-7"><MapView id="samgeoCandidateMap"><BasemapSwitcher /> <GeoJSON data={features} style={{ color: "#7c3aed", weight: 2, fillOpacity: 0.2 }} /></MapView></div><div className="col-lg-5" style={{ maxHeight: 260, overflowY: "auto" }}>{features.features.map((feature, index) => <div className="d-flex gap-1 align-items-center mb-1" key={`${index}-${feature.properties?.segment_id ?? "segment"}`}><input className="form-control form-control-sm" value={String(feature.properties?.class_label ?? classLabel)} onChange={(event) => editFeatureLabel(index, event.target.value)} aria-label={`Label polygon ${index + 1}`} /><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteFeature(index)} aria-label={`Hapus polygon ${index + 1}`}><i className="bi bi-trash" /></button></div>)}</div></div></>}
      </div>
    </div>
  );
}
