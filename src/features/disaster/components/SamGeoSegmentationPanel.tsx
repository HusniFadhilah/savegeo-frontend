import { useEffect, useMemo, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import { ApiError } from "@/services/apiClient";
import { fetchEventSamGeoCapabilities, fetchEventSegmentationJob, startEventSegmentation, fetchSamGeoJob, startSamGeoSegmentation } from "../api";
import type { DisasterAoiRecord, SatelliteImageryRecord, SamGeoCapabilities, SamGeoClass, SamGeoJob, SamGeoMode } from "../types";

interface Props {
  eventId: number;
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

function FitCandidates({ geometry }: { geometry: GeoJSON.GeoJsonObject }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.geoJSON(geometry).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 18, padding: [15, 15] });
  }, [geometry, map]);
  return null;
}

export default function SamGeoSegmentationPanel({ eventId, aoi, imagery }: Props) {
  const [open, setOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<SamGeoCapabilities | null>(null);
  const [mode, setMode] = useState<SamGeoMode>("prompt_based");
  const [cropSize, setCropSize] = useState<500 | 1000 | 2000>(1000);
  const [jobSource, setJobSource] = useState<"event" | "manual">("event");
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
    if (!open) return;
    let cancelled = false;
    fetchEventSamGeoCapabilities().then(value => { if (!cancelled) setCapabilities(value); }).catch(() => { if (!cancelled) setCapabilities(null); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    const entry = [...imagery.post, ...imagery.pre].find(image => image.source_kind === "local_upload" && image.resolution_m != null && image.resolution_m <= 3);
    setImageryId(entry ? String(entry.id) : "");
    setJob(null); setFeatures(null); setError(null);
  }, [eventId, imagery]);

  useEffect(() => {
    if (capabilities?.available && capabilities.modes?.length && !capabilities.modes.includes(mode)) {
      setMode(capabilities.modes[0]);
    }
  }, [capabilities, mode]);

  useEffect(() => {
    if (!job?.job_id || job.status !== "running") return;
    const timer = window.setTimeout(() => {
      const request = jobSource === "event" ? fetchEventSegmentationJob(eventId, job.job_id) : fetchSamGeoJob(job.job_id);
      request.then(setJob).catch((err) => { setError(message(err)); setJob(current => current ? { ...current, status: "failed" } : null); });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [job, jobSource, eventId]);

  useEffect(() => {
    if (job?.result) setFeatures(job.result);
  }, [job]);

  const start = async () => {
    if (!aoi?.geojson) return setError("AOI belum tersedia");
    if (!selectedImagery && !upload && !itemUrl.trim()) return setError("Pilih imagery event atau unggah GeoTIFF/COG");
    if (mode === "prompt_based" && classLabel === "custom_prompt" && !prompt.trim()) return setError("Isi custom prompt");
    setError(null);
    setFeatures(null);
    try {
      const result = selectedImagery ? await startEventSegmentation(eventId, {
        imagery_id: selectedImagery.id, mode, class_label: classLabel,
        prompt: classLabel === "custom_prompt" ? prompt.trim() : undefined,
        confidence_threshold: confidence, center_crop_m: cropSize,
      }) : await startSamGeoSegmentation({
        item_url: upload ? undefined : itemUrl.trim(),
        file: upload,
        aoi: aoi.geojson,
        mode,
        class_label: mode === "prompt_based" ? classLabel : undefined,
        prompt: mode === "prompt_based" ? (classLabel === "custom_prompt" ? prompt.trim() : classLabel) : undefined,
        confidence_threshold: confidence,
      });
      setJobSource(selectedImagery ? "event" : "manual");
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
      <button type="button" className="card-header py-2 disaster-soft-header border-0 text-start" aria-expanded={open} onClick={() => setOpen(value => !value)}><i className="bi bi-magic me-1" /> Segmentasi objek · bangunan, jalan, air, pohon</button>
      {open && <div className="card-body">
        <div className="alert alert-warning py-2 small">Hasil segmentasi adalah kandidat dan berstatus review_required. Jangan menafsirkannya sebagai kerusakan terkonfirmasi.</div>
        {!capabilities?.available && <div className="text-muted small mb-2">Runtime SamGeo belum tersedia pada server.</div>}
        <div className="row g-2">
          <div className="col-md-3"><label className="form-label small">Imagery pre/post</label><select className="form-select form-select-sm" value={imageryId} onChange={(event) => setImageryId(event.target.value)}><option value="">Upload/URL manual</option>{[...imagery.pre, ...imagery.post].map((entry) => <option key={entry.id} value={entry.id} disabled={entry.source_kind !== "local_upload" || entry.resolution_m == null || entry.resolution_m > 3}>{entry.phase} · {entry.satellite} · {entry.acquisition_date} · {entry.resolution_m ?? "?"} m</option>)}</select></div>
          <div className="col-md-3"><label className="form-label small">GeoTIFF/COG upload</label><input className="form-control form-control-sm" type="file" accept=".tif,.tiff" disabled={!!selectedImagery} onChange={(event) => setUpload(event.target.files?.[0])} /></div>
          <div className="col-md-3"><label className="form-label small">COG URL</label><input className="form-control form-control-sm" value={itemUrl} disabled={!!selectedImagery} onChange={(event) => setItemUrl(event.target.value)} placeholder="https://..." /></div>
          <div className="col-md-3"><label className="form-label small">Mode</label><select className="form-select form-select-sm" value={mode} onChange={(event) => setMode(event.target.value as SamGeoMode)}><option value="automatic">Automatic</option><option value="prompt_based" disabled={!capabilities?.modes?.includes("prompt_based")}>Prompt-based</option></select></div>
        </div>
        {selectedImagery && <label className="form-label small mt-2">Potongan di pusat AOI <select className="form-select form-select-sm" value={cropSize} onChange={e => setCropSize(Number(e.target.value) as 500 | 1000 | 2000)}><option value={500}>500 m</option><option value={1000}>1 km</option><option value={2000}>2 km</option></select><span className="text-muted">Potongan membatasi beban model dan menjaga detail. Hasil hanya mencakup potongan ini.</span></label>}
        {mode === "prompt_based" && <div className="row g-2 mt-1"><div className="col-md-4"><label className="form-label small">Kelas</label><select className="form-select form-select-sm" value={classLabel} onChange={(event) => setClassLabel(event.target.value as SamGeoClass)}>{CLASS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="col-md-4"><label className="form-label small">Custom prompt</label><input className="form-control form-control-sm" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={classLabel !== "custom_prompt"} placeholder="Contoh: buildings" /></div><div className="col-md-4"><label className="form-label small">Ambang deteksi: {confidence.toFixed(2)}</label><input className="form-range" type="range" min="0" max="1" step="0.05" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></div></div>}
        {error && <div className="alert alert-danger py-1 px-2 small mt-2">{error}</div>}
        <div className="d-flex gap-2 mt-2"><button type="button" className="btn btn-sm btn-primary" onClick={start} disabled={job?.status === "running" || !aoi || !capabilities?.available}>{job?.status === "running" ? "Memproses…" : "Segment"}</button>{features && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => downloadGeoJson(features)}>Export GeoJSON</button>}</div>
        {job?.status === "running" && <div className="small text-muted mt-2" role="status">Job {job.job_id} sedang diproses…</div>}
        {job?.status === "failed" && <div role="alert" className="alert alert-danger mt-2">{job.message || "Pekerjaan segmentasi gagal"}</div>}
        {features && <><div className="small text-muted mt-2">{features.features.length} polygon kandidat · {String(job?.result?.metadata?.acquisition_date ?? "Tanggal sumber manual")} · resolusi pemrosesan {typeof job?.result?.metadata?.effective_resolution_m === "number" ? job.result.metadata.effective_resolution_m.toFixed(2) : "?"} m · review_required. Ambang deteksi bukan probabilitas kerusakan. Hitungan polygon belum menghitung bangunan rusak.</div><div className="row g-2 mt-1"><div className="col-lg-7"><MapView id="samgeoCandidateMap"><BasemapSwitcher /><FitCandidates geometry={features.features.length ? features : aoi!.geojson} /> <GeoJSON key={`${job?.job_id}-${features.features.length}`} data={features} style={{ color: "#7c3aed", weight: 2, fillOpacity: 0.2 }} /></MapView></div><div className="col-lg-5" style={{ maxHeight: 260, overflowY: "auto" }}>{features.features.map((feature, index) => <div className="d-flex gap-1 align-items-center mb-1" key={`${index}-${feature.properties?.segment_id ?? "segment"}`}><input className="form-control form-control-sm" value={String(feature.properties?.class_label ?? "Kandidat objek")} onChange={(event) => editFeatureLabel(index, event.target.value)} aria-label={`Label polygon ${index + 1}`} /><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteFeature(index)} aria-label={`Hapus polygon ${index + 1}`}><i className="bi bi-trash" /></button></div>)}</div></div></>}
      </div>}
    </div>
  );
}
