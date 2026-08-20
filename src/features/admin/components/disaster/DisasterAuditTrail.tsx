import { useEffect, useState } from "react";
import { getDisasterAudit } from "../../api";
import type { DisasterAuditLogEntry } from "../../types";

interface Props {
  eventId: number;
}

/** Simple read-only list from `GET /admin/disasters/{id}/audit` - newest
 * first, one row per admin mutation regardless of which sub-entity
 * (AOI/imagery/run/result/hotspot) actually changed (all logged under
 * `resource_type="disaster_event"`). */
export default function DisasterAuditTrail({ eventId }: Props) {
  const [logs, setLogs] = useState<DisasterAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDisasterAudit(eventId)
      .then((res) => {
        if (!cancelled) setLogs(res.logs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat audit trail");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>Audit Trail</span>
      </div>
      <div className="card-body-custom">
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Memuat...</div>}
        {error && <div className="alert alert-danger py-1 px-2 small">{error}</div>}
        {!loading && !error && logs.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Belum ada aktivitas tercatat untuk kejadian ini.</div>
        )}
        {!loading && !error && logs.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "50%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Admin</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.created_at ? new Date(log.created_at).toLocaleString("id-ID") : "—"}</td>
                    <td>
                      <span className="badge-label">{log.action}</span>
                    </td>
                    <td>{log.admin_user_id ?? "—"}</td>
                    <td className="tbl-mono" style={{ whiteSpace: "normal", fontSize: 11 }}>
                      {log.detail ? JSON.stringify(log.detail) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
