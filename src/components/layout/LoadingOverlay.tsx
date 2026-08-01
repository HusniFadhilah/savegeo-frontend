import { useUiStore } from "@/hooks/useUiStore";

export default function LoadingOverlay() {
  const loading = useUiStore((s) => s.loading);

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
        <div className="small text-muted mt-2">Estimasi tahap proses</div>
      </div>
    </div>
  );
}
