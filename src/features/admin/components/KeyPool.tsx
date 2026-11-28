import { useCallback, useEffect, useState } from "react";
import { getKeyPoolStatus, saveConfigKey } from "../api";
import { KEY_POOL_PROVIDERS } from "../types";
import type { KeyPoolStatus } from "../types";
import { useAdmin } from "../AdminContext";
import { useBilingualCopy } from "@/hooks/useBilingualCopy";

export default function KeyPool() {
  const c = useBilingualCopy();
  const { notify } = useAdmin();
  const [status, setStatus] = useState<KeyPoolStatus>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getKeyPoolStatus();
      setStatus(r || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : c("Gagal memuat kumpulan kunci", "Failed to load key pool"));
    } finally {
      setLoading(false);
    }
  }, [c]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (pid: string) => {
    setSavingId(pid);
    try {
      const val = (drafts[pid] ?? "").trim();
      await saveConfigKey(`ai.backup_keys.${pid}`, val);
      notify(c(`Kunci cadangan ${pid} disimpan`, `Backup key for ${pid} saved`), "s");
      setOpenId(null);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : c("Gagal menyimpan", "Save failed"), "e");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="card" style={{ marginBottom: "0.875rem" }}>
      <div className="card-header-custom">
        <span>
          <span className="stat-badge badge-blue" style={{ marginRight: 6 }}>
            {c("kumpulan", "pool")}
          </span>
          {c("Kunci cadangan", "Backup key pool")}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{c("Kunci diganti otomatis saat batas laju tercapai", "Keys rotate automatically when rate limits are reached")}</span>
      </div>
      <div className="card-body-custom" style={{ padding: "0.5rem 1rem 1rem" }}>
        {loading && <div style={{ color: "var(--text-muted)", padding: "8px 0", fontSize: 12 }}>{c("Memuat…", "Loading…")}</div>}
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
                    <span className="kp-badge kp-none">{c("Belum ada kunci cadangan", "No backup keys")}</span>
                  ) : (
                    <>
                      <span className={`kp-badge ${cls}`}>
                        {avail}/{total} {c("tersedia", "available")}
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
                  {c("Edit", "Edit")}
                </button>
                {openId === p.id && (
                  <div className="kp-edit">
                    <textarea
                      rows={4}
                      placeholder={c("Tempel kunci API cadangan, satu per baris\nKunci utama sudah otomatis terdaftar", "Paste backup API keys, one per line\nThe primary key is already registered automatically")}
                      value={drafts[p.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    />
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button type="button" className="btn-sm primary" disabled={savingId === p.id} onClick={() => save(p.id)}>
                        {savingId === p.id ? c("Menyimpan…", "Saving…") : c("Simpan", "Save")}
                      </button>
                      <button type="button" className="btn-sm" onClick={() => setOpenId(null)}>
                        {c("Batal", "Cancel")}
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
