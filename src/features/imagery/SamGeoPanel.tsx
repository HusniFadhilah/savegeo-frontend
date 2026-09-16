import { useEffect, useRef, useState } from "react";
import type { FeatureCollection } from "geojson";
import type { AoiFeature } from "@/types/map";
import { apiClient } from "@/services/apiClient";
import type { ImageryScene } from "./types";

type Job = { job_id: string; status: "running" | "complete" | "failed"; message?: string; result?: FeatureCollection };
type Capability = { available: boolean; message: string };

export default function SamGeoPanel({ scene, aoi, assetKey, bands, rescale, providerKey, onResult }: {
  scene: ImageryScene | null;
  aoi: AoiFeature | null;
  assetKey: string;
  bands: string;
  rescale: string;
  providerKey?: string;
  onResult: (result: FeatureCollection | null) => void;
}) {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FeatureCollection | null>(null);
  const [visible, setVisible] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    apiClient.get<Capability>("/imagery/samgeo/status").then((value) => { if (active) setCapability(value); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    generation.current += 1;
    setResult(null); setJobId(null); setBusy(false); setError(""); setVisible(true);
    onResult(null);
    return () => { generation.current += 1; };
  }, [scene?.id, aoi, assetKey, bands, rescale, onResult]);

  useEffect(() => {
    if (!result) { setDownloadUrl(""); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(result)], { type: "application/geo+json" }));
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const poll = async () => {
      try {
        const job = await apiClient.get<Job>(`/imagery/samgeo/jobs/${jobId}`);
        if (!active) return;
        failures = 0;
        if (job.status === "complete" && job.result) {
          setResult(job.result); onResult(job.result); setBusy(false); setJobId(null);
        } else if (job.status === "failed") {
          setError(job.message || "Segmentasi gagal"); setBusy(false); setJobId(null);
        } else { timer = setTimeout(poll, 2000); }
      } catch (reason) {
        if (!active) return;
        if (++failures < 5) { timer = setTimeout(poll, 3000); }
        else { setError((reason as Error).message); setBusy(false); setJobId(null); }
      }
    };
    timer = setTimeout(poll, 1000);
    return () => { active = false; clearTimeout(timer); };
  }, [jobId, onResult]);

  async function run() {
    if (!scene || !aoi) return;
    const current = generation.current;
    setBusy(true); setError(""); setResult(null); onResult(null); setVisible(true);
    try {
      const job = await apiClient.post<Job>("/imagery/samgeo/jobs", {
        item_url: scene.id, provider_key: providerKey, aoi, asset_key: assetKey, bands: bands || undefined, rescale: rescale || undefined,
      });
      if (generation.current === current) setJobId(job.job_id);
    } catch (reason) {
      if (generation.current === current) { setError((reason as Error).message); setBusy(false); }
    }
  }

  return <section className="mb-3 border-top pt-3" aria-label="AI segmentation SamGeo">
    <div className="fw-bold mb-2"><i className="bi bi-bounding-box" /> AI Segmentation SamGeo</div>
    <div className="small text-muted mb-2">SAM ViT-B · Otomatis · AOI · Maks. 1024 px</div>
    {!scene && <div className="small text-muted mb-2">Tersedia untuk scene STAC/COG, Planet Open Data, dan Vantor/Maxar.</div>}
    {capability && !capability.available && <div role="status" className="alert alert-warning small py-2">{capability.message}</div>}
    <button type="button" className="btn btn-sm btn-outline-primary w-100" disabled={busy || !scene || !aoi || !capability?.available}
      onClick={() => void run()}>
      <i className={busy ? "bi bi-hourglass-split" : "bi bi-bounding-box"} /> {busy ? "Memproses segmentasi..." : "Segmentasi AOI"}
    </button>
    {busy && <div className="small text-muted mt-2" role="status">Menjalankan SAM ViT-B. Pemrosesan CPU dapat memerlukan beberapa menit.</div>}
    {error && <div role="alert" className="alert alert-danger small py-2 mt-2 text-break">{error}</div>}
    {result && <div className="mt-2">
      <label className="form-check-label small d-flex gap-2 align-items-center">
        <input className="form-check-input mt-0" type="checkbox" checked={visible} onChange={(event) => {
          setVisible(event.target.checked); onResult(event.target.checked ? result : null);
        }} /> Hasil segmentasi ({result.features.length} poligon)
      </label>
      {result.features.length === 0 && <div className="small text-muted mt-1">Tidak ada objek terdeteksi pada AOI ini.</div>}
      <a className="btn btn-sm btn-outline-success w-100 mt-2" href={downloadUrl} download="samgeo-segments.geojson">
        <i className="bi bi-download" /> Download GeoJSON
      </a>
    </div>}
  </section>;
}
