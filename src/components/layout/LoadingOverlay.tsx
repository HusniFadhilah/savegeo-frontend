import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/hooks/useUiStore";

/**
 * Global loading indicator - GEE-backed analyses (carbon especially, up to
 * ~10 min for a multi-year delta run) can legitimately run long. Defaults to
 * a full-screen blocking modal (clear "don't touch anything yet" signal for
 * quick analyses), but the request itself is a normal fetch that keeps
 * running regardless of this component's state - "minimize" just stops the
 * overlay div from covering/blocking the rest of the UI so the user can
 * switch modules while it finishes. Fixes the "backend freezes" report: it
 * was never the backend blocking other requests, this overlay was blocking clicks.
 */
export default function LoadingOverlay() {
  const loading = useUiStore((s) => s.loading);
  const minimizeLoading = useUiStore((s) => s.minimizeLoading);
  const restoreLoading = useUiStore((s) => s.restoreLoading);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!loading.visible) return;
    startRef.current = performance.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed((performance.now() - startRef.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [loading.visible]);

  if (!loading.visible) return null;

  if (loading.minimized) {
    return (
      <div className="loading-pill" onClick={restoreLoading} role="button" title="Buka kembali">
        <div className="loading-pill-spinner" />
        <div className="loading-pill-text">
          <div className="loading-pill-title">{loading.text}</div>
          <div className="loading-pill-sub">
            {elapsed.toFixed(0)}s · {loading.progress}%
          </div>
        </div>
        <i className="bi bi-arrows-angle-expand loading-pill-expand" />
      </div>
    );
  }

  return (
    <div className="loading-overlay" style={{ display: "flex" }}>
      <div className="loading-content">
        <button
          type="button"
          className="loading-minimize-btn"
          onClick={minimizeLoading}
          title="Jalankan di background - lanjut pakai modul lain"
        >
          <i className="bi bi-dash-lg" /> Latar belakang
        </button>
        <div className="spinner" />
        <h5>{loading.text}</h5>
        <p className="text-muted">{loading.subtext}</p>
        <div className="progress loading-progress-track mt-3">
          <div
            className="progress-bar progress-bar-striped progress-bar-animated"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loading.progress}
            style={{ width: `${loading.progress}%` }}
          />
        </div>
        <div className="small text-muted mt-2">Estimasi tahap: ±{loading.progress}%</div>
        <div className="loading-timer mt-1">
          <i className="bi bi-clock" /> {elapsed.toFixed(1)}s
        </div>
      </div>
    </div>
  );
}
