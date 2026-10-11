import { useEffect, useState } from "react";
import { fetchHealth } from "@/services/analysisService";
import type { HealthStatus } from "@/types/api";
import { buildLabel, fetchFrontendBuildMetadata, getCompatibilityStatus, localFrontendMetadata, shortCommit, type BuildMetadata } from "@/config/version";
import { fetchBackendVersion } from "@/services/releaseService";

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
    ...(typeof data.database_connected === "boolean" ? [{
      icon: "bi-database",
      label: "Database",
      value: data.database_connected ? "Terhubung" : "Tidak terhubung",
      ok: data.database_connected,
    }] : []),
    {
      icon: "bi-broadcast",
      label: "Google Earth Engine",
      value: data.ee_initialized ? "Aktif" : "Tidak aktif",
      ok: data.ee_initialized,
    },
    {
      icon: "bi-key",
      label: "Model Aktif",
      value: data.active_model || "-",
      ok: Boolean(data.active_model),
    },
  ];
}

export default function SystemStatusModal({ open, onClose }: Props) {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [frontendMetadata, setFrontendMetadata] = useState<BuildMetadata>(localFrontendMetadata);
  const [backendMetadata, setBackendMetadata] = useState<BuildMetadata | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [healthResult, frontendResult, backendResult] = await Promise.allSettled([
      fetchHealth(),
      fetchFrontendBuildMetadata(),
      fetchBackendVersion(),
    ]);
    setData(healthResult.status === "fulfilled" ? healthResult.value : null);
    if (frontendResult.status === "fulfilled") setFrontendMetadata(frontendResult.value);
    setBackendMetadata(backendResult.status === "fulfilled" ? backendResult.value : null);
    try {
      setCheckedAt(new Date());
    } finally {
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
            Status Sistem
          </span>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Tutup" />
        </div>
        <div className="modal-card-body">
          {loading && <div className="text-center text-muted py-3">Memuat...</div>}
          {!loading && !data && (
            <div className="text-danger text-center py-2">
              <i className="bi bi-x-circle me-1" /> Gagal memuat status.
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
            <div className="small text-muted mt-2">Diperbarui: {checkedAt.toLocaleString("id-ID")}</div>
          )}
          <div className="mt-3 pt-3 border-top" aria-label="Informasi versi dan provenance">
            <h6 className="mb-2"><i className="bi bi-box-seam me-2" />Versi &amp; provenance</h6>
            <div className="small d-grid gap-1">
              <div><span className="text-muted">Produk:</span> v{frontendMetadata.product_version}</div>
              <div><span className="text-muted">Frontend:</span> v{frontendMetadata.component_version} · {buildLabel(frontendMetadata)} · {shortCommit(frontendMetadata.commit_sha)}</div>
              <div><span className="text-muted">Backend:</span> {backendMetadata ? `v${backendMetadata.component_version} · ${buildLabel(backendMetadata)} · ${shortCommit(backendMetadata.commit_sha)}` : "metadata tidak tersedia"}</div>
              <div>
                <span className="text-muted">Pasangan:</span>{" "}
                <span className={`badge ${getCompatibilityStatus(frontendMetadata, backendMetadata) === "compatible" ? "bg-success-subtle text-success" : getCompatibilityStatus(frontendMetadata, backendMetadata) === "different" ? "bg-warning-subtle text-warning-emphasis" : "bg-secondary-subtle text-secondary"}`}>
                  {getCompatibilityStatus(frontendMetadata, backendMetadata) === "compatible" ? "kompatibel" : getCompatibilityStatus(frontendMetadata, backendMetadata) === "different" ? "berbeda" : "metadata tidak tersedia"}
                </span>
              </div>
              {backendMetadata?.deployed_at_utc && <div><span className="text-muted">Deploy backend:</span> {new Date(backendMetadata.deployed_at_utc).toLocaleString("id-ID")}</div>}
            </div>
            <a className="small d-inline-block mt-2" href="https://github.com/HusniFadhilah/savegeo-frontend/blob/main/CHANGELOG.md" target="_blank" rel="noreferrer">
              <i className="bi bi-journal-text me-1" />Buka changelog
            </a>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary mt-3" onClick={refresh}>
            <i className="bi bi-arrow-repeat me-1" /> Muat Ulang
          </button>
        </div>
      </div>
    </div>
  );
}
