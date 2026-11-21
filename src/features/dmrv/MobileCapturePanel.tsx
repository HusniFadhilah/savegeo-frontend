import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { env } from "@/config/env";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useUserAuthStore } from "@/hooks/useUserAuthStore";
import { listFieldCaptures, syncFieldCapture, type FieldCaptureDraft } from "./api";
import { describeDmrvError } from "./errors";
import { listQueuedCaptures, removeQueuedCapture, saveQueuedCapture } from "./fieldCaptureQueue";
import type { FieldCapture } from "./integrity/types";

const localDateTime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function MobileCapturePanel({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const language = useI18nStore((state) => state.language);
  const t = useI18nStore((state) => state.t);
  const userId = useUserAuthStore((state) => state.user?.id);
  const adminId = useAuthStore((state) => state.user?.id);
  const principalKey = userId != null ? `user:${userId}` : adminId != null ? `admin:${adminId}` : null;
  const id = language.toLowerCase().startsWith("id");
  const [online, setOnline] = useState(navigator.onLine);
  const [drafts, setDrafts] = useState<FieldCaptureDraft[]>([]);
  const [captures, setCaptures] = useState<FieldCapture[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const autoAttempt = useRef("");
  const photoInput = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    plot_code: "",
    observed_at: localDateTime(),
    latitude: "",
    longitude: "",
    gps_accuracy_m: "",
    observation: "",
    photo: null as File | null,
  });

  const refreshQueue = useCallback(async () => {
    if (!canWrite || !principalKey) { setDrafts([]); return; }
    try {
      setDrafts(await listQueuedCaptures(projectId, principalKey));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [projectId, canWrite, principalKey]);

  const refreshCaptures = useCallback(async () => {
    try {
      setCaptures(await listFieldCaptures(projectId));
    } catch (cause) {
      if (navigator.onLine) setError(describeDmrvError(cause, t));
    }
  }, [projectId, t]);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine || !canWrite || !principalKey || busy) return;
    setBusy(true);
    setError("");
    try {
      const pending = await listQueuedCaptures(projectId, principalKey);
      for (const draft of pending) {
        await syncFieldCapture(projectId, draft);
        await removeQueuedCapture(draft.capture_id);
      }
      setMessage(id ? "Catatan lapangan tersinkron." : "Field notes synced.");
      await Promise.all([refreshQueue(), refreshCaptures()]);
    } catch (cause) {
      setError(describeDmrvError(cause, t));
      await refreshQueue();
    } finally {
      setBusy(false);
    }
  }, [projectId, canWrite, principalKey, busy, id, t, refreshQueue, refreshCaptures]);

  useEffect(() => {
    void refreshQueue();
    void refreshCaptures();
    const onlineChange = () => {
      const connected = navigator.onLine;
      if (connected) autoAttempt.current = "";
      setOnline(connected);
    };
    window.addEventListener("online", onlineChange);
    window.addEventListener("offline", onlineChange);
    return () => {
      window.removeEventListener("online", onlineChange);
      window.removeEventListener("offline", onlineChange);
    };
  }, [refreshQueue, refreshCaptures]);

  useEffect(() => {
    if (!drafts.length) autoAttempt.current = "";
    const key = `${projectId}:${drafts.map((draft) => draft.capture_id).join(",")}`;
    if (online && drafts.length && !busy && autoAttempt.current !== key) {
      autoAttempt.current = key;
      void syncPending();
    }
  }, [online, drafts, busy, syncPending, projectId]);

  async function saveCapture(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || busy) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (!principalKey) throw new Error(id ? "Sesi pengguna tidak tersedia di perangkat ini." : "No signed-in account is available on this device.");
      if (form.photo && (form.photo.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg"].includes(form.photo.type))) {
        throw new Error(id ? "Gunakan foto PNG/JPEG maksimal 5 MB." : "Choose a PNG/JPEG photo up to 5 MB.");
      }
      const draft: FieldCaptureDraft = {
        capture_id: crypto.randomUUID(),
        plot_code: form.plot_code.trim(),
        observed_at: new Date(form.observed_at).toISOString(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        gps_accuracy_m: form.gps_accuracy_m ? Number(form.gps_accuracy_m) : null,
        observation: form.observation.trim(),
        photo: form.photo,
      };
      await saveQueuedCapture(projectId, principalKey, draft);
      setDrafts(await listQueuedCaptures(projectId, principalKey));
      setMessage(id ? "Tersimpan di perangkat. Akan dikirim saat tersambung." : "Saved on this device. It will sync when online.");
      if (photoInput.current) photoInput.current.value = "";
      setForm({ plot_code: "", observed_at: localDateTime(), latitude: "", longitude: "", gps_accuracy_m: "", observation: "", photo: null });
      if (navigator.onLine) {
        await syncFieldCapture(projectId, draft);
        await removeQueuedCapture(draft.capture_id);
        setMessage(id ? "Catatan lapangan tersinkron." : "Field note synced.");
        await Promise.all([refreshQueue(), refreshCaptures()]);
      }
    } catch (cause) {
      setError(describeDmrvError(cause, t));
      await refreshQueue();
    } finally {
      setBusy(false);
    }
  }

  function useDeviceLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError(id ? "Peramban tidak menyediakan GPS." : "This browser does not provide GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setForm((old) => ({
        ...old,
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
        gps_accuracy_m: String(Math.round(coords.accuracy)),
      })),
      () => setError(id ? "Lokasi tidak tersedia. Isi koordinat secara manual." : "Location unavailable. Enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <section className="card card-body mb-4" aria-labelledby="dmrv-mobile-capture-title">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div>
          <h3 id="dmrv-mobile-capture-title" className="h6 mb-1">{id ? "Catatan lapangan seluler" : "Mobile field notes"}</h3>
          <p className="small text-muted mb-0">{id ? "Simpan catatan, koordinat, dan foto di perangkat saat luring. Sinkronkan ketika jaringan tersedia." : "Queue notes, coordinates, and photos on the device while offline; sync when a connection is available."}</p>
        </div>
        <span className={`badge ${online ? "text-bg-success" : "text-bg-secondary"}`}>{online ? (id ? "Terhubung" : "Online") : (id ? "Luring" : "Offline")}</span>
      </div>

      {canWrite ? (
        <>
          <form onSubmit={(event) => void saveCapture(event)}>
            <div className="row g-2">
              <div className="col-sm-6 col-lg-3">
                <label className="form-label" htmlFor="capture-plot">{id ? "Kode plot" : "Plot code"}</label>
                <input id="capture-plot" className="form-control" required maxLength={64} value={form.plot_code} onChange={(event) => setForm((old) => ({ ...old, plot_code: event.target.value }))} />
              </div>
              <div className="col-sm-6 col-lg-3">
                <label className="form-label" htmlFor="capture-time">{id ? "Waktu pengamatan" : "Observation time"}</label>
                <input id="capture-time" type="datetime-local" className="form-control" required value={form.observed_at} onChange={(event) => setForm((old) => ({ ...old, observed_at: event.target.value }))} />
              </div>
              <div className="col-sm-6 col-lg-2">
                <label className="form-label" htmlFor="capture-lat">Latitude</label>
                <input id="capture-lat" type="number" step="any" min="-85" max="85" className="form-control" required value={form.latitude} onChange={(event) => setForm((old) => ({ ...old, latitude: event.target.value }))} />
              </div>
              <div className="col-sm-6 col-lg-2">
                <label className="form-label" htmlFor="capture-lon">Longitude</label>
                <input id="capture-lon" type="number" step="any" min="-180" max="180" className="form-control" required value={form.longitude} onChange={(event) => setForm((old) => ({ ...old, longitude: event.target.value }))} />
              </div>
              <div className="col-sm-6 col-lg-2">
                <label className="form-label" htmlFor="capture-accuracy">{id ? "Akurasi GPS (m)" : "GPS accuracy (m)"}</label>
                <input id="capture-accuracy" type="number" step="any" min="0" className="form-control" value={form.gps_accuracy_m} onChange={(event) => setForm((old) => ({ ...old, gps_accuracy_m: event.target.value }))} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="capture-observation">{id ? "Pengamatan" : "Observation"}</label>
                <textarea id="capture-observation" className="form-control" required maxLength={8000} rows={2} value={form.observation} onChange={(event) => setForm((old) => ({ ...old, observation: event.target.value }))} />
              </div>
              <div className="col-sm-6">
                <label className="form-label" htmlFor="capture-photo">{id ? "Foto bukti (opsional, PNG/JPEG ≤5 MB)" : "Evidence photo (optional, PNG/JPEG ≤5 MB)"}</label>
                <input id="capture-photo" ref={photoInput} type="file" accept="image/png,image/jpeg" capture="environment" className="form-control" onChange={(event) => setForm((old) => ({ ...old, photo: event.target.files?.[0] || null }))} />
              </div>
              <div className="col-sm-6 d-flex align-items-end gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={useDeviceLocation}>{id ? "Ambil lokasi GPS" : "Use device GPS"}</button>
                <button type="submit" className="btn btn-success" disabled={busy}>{busy ? (id ? "Menyimpan…" : "Saving…") : (id ? "Simpan catatan" : "Save note")}</button>
                {drafts.length > 0 && <button type="button" className="btn btn-outline-success" disabled={!online || busy} onClick={() => void syncPending()}>{id ? `Sinkronkan ${drafts.length}` : `Sync ${drafts.length}`}</button>}
              </div>
            </div>
          </form>
          {drafts.length > 0 && <p className="small text-warning mt-2 mb-0">{id ? `${drafts.length} catatan masih menunggu sinkronisasi di perangkat ini.` : `${drafts.length} note(s) are waiting to sync from this device.`}</p>}
        </>
      ) : null}
      {message && <p role="status" className="small text-success mt-2 mb-0">{message}</p>}
      {error && <p role="alert" className="small text-danger mt-2 mb-0">{error}</p>}

      {captures.length > 0 && (
        <div className="mt-3">
          <h4 className="small fw-semibold">{id ? "Catatan tersinkron terbaru" : "Latest synced notes"}</h4>
          <div className="list-group list-group-flush">
            {captures.slice(0, 10).map((capture) => (
              <div className="list-group-item px-0" key={capture.capture_id}>
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <strong>{capture.plot_code} · {new Date(capture.observed_at).toLocaleString()}</strong>
                  <span className="small text-muted">{capture.latitude.toFixed(5)}, {capture.longitude.toFixed(5)}{capture.gps_accuracy_m === null ? "" : ` · GPS ±${capture.gps_accuracy_m} m`}</span>
                </div>
                <p className="small mb-1">{capture.observation}</p>
                {capture.qa_flags.length > 0 && <p className="small text-warning mb-1">{(id ? "Perlu ditinjau: " : "Review flags: ") + capture.qa_flags.join(", ")}</p>}
                {capture.photo_url && <a className="small" href={`${env.apiBaseUrl}${capture.photo_url}`} target="_blank" rel="noreferrer">{id ? "Buka foto bukti" : "Open evidence photo"}</a>}
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="small text-muted mt-2 mb-0">{id ? "Simpan catatan tanpa nama atau data pribadi sensitif. Periksa bendera QA sebelum memakai data untuk validasi." : "Avoid personal or sensitive identity details. Review QA flags before using a note for validation."}</p>
    </section>
  );
}
