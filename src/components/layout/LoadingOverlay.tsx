import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/hooks/useUiStore";

export default function LoadingOverlay() {
  const loading = useUiStore((s) => s.loading);
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

  return (
    <div className="loading-overlay" style={{ display: "flex" }}>
      <div className="loading-content">
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
