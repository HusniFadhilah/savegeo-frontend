import { useEffect, useState } from "react";
import { getKeyPoolStatus, saveConfigKey } from "../api";
import { KEY_POOL_PROVIDERS } from "../types";
import type { KeyPoolStatus } from "../types";
import { useAdmin } from "../AdminContext";

export default function KeyPool() {
  const { notify } = useAdmin();
  const [status, setStatus] = useState<KeyPoolStatus>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getKeyPoolStatus();
      setStatus(r || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat key pool");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (pid: string) => {
    setSavingId(pid);
    try {
      const val = (drafts[pid] ?? "").trim();
      await saveConfigKey(`ai.backup_keys.${pid}`, val);
      notify(`Kunci cadangan ${pid} disimpan`, "s");
      setOpenId(null);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal simpan", "e");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="card" style={{ marginBottom: "0.875rem" }}>
      <div className="card-header-custom">
        <span>
          <span className="stat-badge badge-blue" style={{ marginRight: 6 }}>
            pool
          </span>
          Kunci Cadangan (Key Pool)
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Otomatis ganti kunci saat rate-limit habis</span>
      </div>
      <div className="card-body-custom" style={{ padding: "0.5rem 1rem 1rem" }}>
        {loading && <div style={{ color: "var(--text-muted)", padding: "8px 0", fontSize: 12 }}>Memuat...</div>}
        {!loading && error && (
          <div className="alert alert-danger py-1 px-2 small mb-0">{error}</div>
        )}
        {!loading &&
          !error &&
          KEY_POOL_PROVIDERS.map((p) => {
            const keys = status[p.id] || [];
            const avail = keys.filter((k) => k.available).length;
            const total = keys.length;
            const cls = total === 0 ? "kp-none" : avail === 0 ? "kp-none" : avail < total ? "kp-partial" : "kp-ok";
            return (
              <div className="kp-row" key={p.id}>
                <div className="kp-label">
                  {p.icon} {p.label}
                </div>
                <div className="kp-status">
                  {total === 0 ? (
                    <span className="kp-badge kp-none">Tidak ada kunci cadangan</span>
                  ) : (
                    <>
                      <span className={`kp-badge ${cls}`}>
                        {avail}/{total} tersedia
                      </span>
                      {keys.map((k, idx) => (
                        <span className="kp-key-chip" key={`${p.id}-${idx}`}>
                          {k.prefix} <em>{k.available ? "✅ aktif" : `⏳ ${k.available_in}d lagi`}</em>
                        </span>
                      ))}
                    </>
                  )}
                </div>
                <button type="button" className="btn-sm" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                  Edit
                </button>
                {openId === p.id && (
                  <div className="kp-edit">
                    <textarea
                      rows={4}
                      placeholder={"Tempel kunci API cadangan, satu per baris\nKunci utama sudah otomatis terdaftar"}
                      value={drafts[p.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button type="button" className="btn-sm primary" disabled={savingId === p.id} onClick={() => save(p.id)}>
                        {savingId === p.id ? "Menyimpan..." : "Simpan"}
                      </button>
                      <button type="button" className="btn-sm" onClick={() => setOpenId(null)}>
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
