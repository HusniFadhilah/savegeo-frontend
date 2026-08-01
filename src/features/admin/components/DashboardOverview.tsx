import { useEffect, useState } from "react";
import { getHealth, getGeeStatus, listModels, getConfig, reinitEE } from "../api";
import type { AdminSection } from "../types";
import { useAdmin } from "../AdminContext";

interface OverviewData {
  eeOk: boolean;
  activeCredLabel: string;
  activeCredEmail: string | null;
  modelCount: number | string;
  cfgCount: number | string;
}

export default function DashboardOverview({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { refreshHealth, notify } = useAdmin();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reiniting, setReiniting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [health, gee, models, cfg] = await Promise.all([
        getHealth(),
        getGeeStatus(),
        listModels("carbon"),
        getConfig(),
      ]);
      const cfgCount = Object.values(cfg.config).reduce((s, v) => s + v.length, 0);
      setData({
        eeOk: Boolean(health.ee_initialized),
        activeCredLabel: gee.active_credential?.label ?? "Tidak ada",
        activeCredEmail: gee.active_credential?.client_email ?? null,
        modelCount: models.models.length,
        cfgCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="adm-loading">Memuat overview...</div>;
  }
  if (error || !data) {
    return (
      <div className="alert alert-danger py-2 px-3 small">
        {error || "Gagal memuat data"}{" "}
        <button type="button" className="btn-sm" onClick={load}>
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-val">{data.eeOk ? "Aktif" : "Offline"}</div>
          <div className="stat-label">Earth Engine</div>
          <span className={`stat-badge ${data.eeOk ? "badge-green" : "badge-red"}`}>
            {data.eeOk ? "initialized" : "not ready"}
          </span>
        </div>
        <div className="stat-card">
          <div className="stat-val" style={{ fontSize: 13, paddingTop: 4 }}>
            {data.activeCredLabel}
          </div>
          <div className="stat-label">Credential Aktif</div>
          <span className="stat-badge badge-blue">service account</span>
        </div>
        <div className="stat-card">
          <div className="stat-val">{data.modelCount}</div>
          <div className="stat-label">ML Models</div>
          <span className="stat-badge badge-blue">carbon</span>
        </div>
        <div className="stat-card">
          <div className="stat-val">{data.cfgCount}</div>
          <div className="stat-label">Config Keys</div>
          <span className="stat-badge badge-gray">kategori</span>
        </div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-header-custom">
            <span>Status sistem</span>
          </div>
          <div className="card-body-custom">
            {[
              ["Earth Engine", data.eeOk ? "Initialized" : "Offline", data.eeOk ? "badge-green" : "badge-red"],
              ["Database", "Connected", "badge-green"],
              [
                "Credential aktif",
                data.activeCredEmail ? data.activeCredEmail.split("@")[0] : "—",
                "badge-blue",
              ],
              ["Active models", `${data.modelCount} carbon`, "badge-blue"],
            ].map(([label, val, cls]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
                <span className={`stat-badge ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header-custom">
            <span>Aksi cepat</span>
          </div>
          <div className="card-body-custom" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button type="button" className="btn-sm primary" onClick={() => onNavigate("ge")}>
              <i className="bi bi-key" /> Kelola GEE Credentials
            </button>
            <button type="button" className="btn-sm primary" onClick={() => onNavigate("ml")}>
              <i className="bi bi-upload" /> Upload ML Model
            </button>
            <button type="button" className="btn-sm primary" onClick={() => onNavigate("cf")}>
              <i className="bi bi-pencil-square" /> Edit System Config
            </button>
            <button
              type="button"
              className="btn-sm success"
              disabled={reiniting}
              onClick={async () => {
                setReiniting(true);
                try {
                  await reinitEE();
                  notify("Earth Engine berhasil diinisialisasi ulang", "s");
                } catch (err) {
                  notify(err instanceof Error ? err.message : "Gagal reinit EE", "e");
                } finally {
                  setReiniting(false);
                  refreshHealth();
                  await load();
                }
              }}
            >
              <i className="bi bi-power" /> {reiniting ? "Memproses..." : "Reinitialize Earth Engine"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
