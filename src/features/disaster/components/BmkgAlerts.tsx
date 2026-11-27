import type { BmkgAlert } from "../types";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

interface Props {
  loading: boolean;
  error: string | null;
  alerts: BmkgAlert[] | null;
}

/**
 * Ported from DisasterMapping.loadBmkgAlerts() (main.js ~L5337-5365). All
 * feed content (title/area/description/published_at) is untrusted external
 * text - rendered as plain React children only, never dangerouslySetInnerHTML.
 */
export default function BmkgAlerts({ loading, error, alerts }: Props) {
  const c = useBilingualCopy();
  if (loading) {
    return (
      <div className="alert alert-info py-2 mb-3">
        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
        {c("Mengambil peringatan dini BMKG…", "Loading BMKG early warnings…")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-warning py-2 mb-3">
        <strong>{c("Peringatan BMKG tidak dapat dimuat.", "BMKG alerts could not be loaded.")}</strong> {error}
      </div>
    );
  }

  if (!alerts) return null;

  if (!alerts.length) {
    return (
      <div className="alert alert-success py-2 mb-3">
        {c("Tidak ada peringatan BMKG pada umpan yang dikonfigurasi.", "No BMKG alerts in the configured feed.")}
      </div>
    );
  }

  return (
    <div className="card mb-3">
      <div className="card-header bg-info text-white py-2">
        <i className="bi bi-cloud-rain-heavy-fill" /> {c("Peringatan Dini BMKG", "BMKG Early Warnings")} ({alerts.length})
      </div>
      <div className="list-group list-group-flush" style={{ maxHeight: 260, overflow: "auto" }}>
        {alerts.map((alert, idx) => (
          <div className="list-group-item" key={`${alert.title ?? alert.area ?? "alert"}-${idx}`}>
            <div className="fw-semibold">{alert.title || alert.area || c("Peringatan BMKG", "BMKG alert")}</div>
            <div className="small text-muted">{alert.published_at || ""}</div>
            <div className="small">{(alert.description || "").slice(0, 260)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
