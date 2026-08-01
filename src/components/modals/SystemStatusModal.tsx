import { useEffect, useState } from "react";
import { fetchHealth } from "@/services/analysisService";
import type { HealthStatus } from "@/types/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface StatusRow {
  icon: string;
  label: string;
  value: string;
  ok: boolean;
}

function buildRows(data: HealthStatus | null): StatusRow[] {
  if (!data) return [];
  return [
    { icon: "bi-server", label: "Backend", value: data.status === "ok" ? "Online" : "Error", ok: data.status === "ok" },
    {
      icon: "bi-broadcast",
      label: "Google Earth Engine",
      value: data.ee_initialized ? "Initialized" : "Inactive",
      ok: data.ee_initialized,
    },
    {
      icon: "bi-key",
      label: "Active Model",
      value: data.active_model || "-",
      ok: Boolean(data.active_model),
    },
  ];
}

export default function SystemStatusModal({ open, onClose }: Props) {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetchHealth();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setCheckedAt(new Date());
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop-custom" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card-header">
          <span>
            <i className="bi bi-activity me-2" />
            System Status
          </span>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>
        <div className="modal-card-body">
          {loading && <div className="text-center text-muted py-3">Loading...</div>}
          {!loading && !data && (
            <div className="text-danger text-center py-2">
              <i className="bi bi-x-circle me-1" /> Failed to fetch status.
            </div>
          )}
          {!loading &&
            data &&
            buildRows(data).map((r) => (
              <div key={r.label} className="d-flex align-items-center justify-content-between py-2 border-bottom">
                <span className="text-muted small">
                  <i className={`bi ${r.icon} me-2`} />
                  {r.label}
                </span>
                <span className={`badge ${r.ok ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}>
                  {r.value}
                </span>
              </div>
            ))}
          {checkedAt && (
            <div className="small text-muted mt-2">Updated: {checkedAt.toLocaleString("id-ID")}</div>
          )}
          <button type="button" className="btn btn-sm btn-outline-secondary mt-3" onClick={refresh}>
            <i className="bi bi-arrow-repeat me-1" /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
