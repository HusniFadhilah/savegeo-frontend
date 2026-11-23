import { AdminTableNumberCell, AdminTableNumberHeader } from "@/features/admin/components/AdminTableNumber";
import { useEffect, useState } from "react";
import { getDisasterAudit } from "../../api";
import type { DisasterAuditLogEntry } from "../../types";
import { useI18nStore } from "@/hooks/useI18nStore";

interface Props {
  eventId: number;
}

/** Simple read-only list from `GET /admin/disasters/{id}/audit` - newest
 * first, one row per admin mutation regardless of which sub-entity
 * (AOI/imagery/run/result/hotspot) actually changed (all logged under
 * `resource_type="disaster_event"`). */
export default function DisasterAuditTrail({ eventId }: Props) {
  const t = useI18nStore((state) => state.t);
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
        if (!cancelled) setError(err instanceof Error ? err.message : t("admin.disaster.auditLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, t]);

  return (
    <div className="card">
      <div className="card-header-custom">
        <span>{t("admin.disaster.auditTrail")}</span>
      </div>
      <div className="card-body-custom">
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{t("admin.disaster.loadingShort")}</div>}
        {error && <div className="alert alert-danger py-1 px-2 small">{error}</div>}
        {!loading && !error && logs.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{t("admin.disaster.auditEmpty")}</div>
        )}
        {!loading && !error && logs.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl tbl-wide">
              <colgroup>
                <col className="admin-table-number-col" />
                <col style={{ width: "calc(18% - 0.585rem)" }} />
                <col style={{ width: "calc(18% - 0.585rem)" }} />
                <col style={{ width: "calc(14% - 0.455rem)" }} />
                <col style={{ width: "calc(50% - 1.625rem)" }} />
              </colgroup>
              <thead>
                <tr>
                  <AdminTableNumberHeader />
                  <th>{t("admin.disaster.time")}</th>
                  <th>{t("admin.disaster.actions")}</th>
                  <th>{t("admin.disaster.admin")}</th>
                  <th>{t("admin.disaster.detailsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={log.id}>
                    <AdminTableNumberCell index={index} />
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
