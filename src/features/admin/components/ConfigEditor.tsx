import { useEffect, useMemo, useState } from "react";
import { getConfig, resetAllConfig, saveConfig } from "../api";
import { AI_PROVIDERS, CAT_COLORS, CAT_LABELS } from "../types";
import type { AdminConfigCategories, AdminConfigItem } from "../types";
import AiProviderConfig from "./AiProviderConfig";
import KeyPool from "./KeyPool";
import { useAdmin } from "../AdminContext";

/** Full admin system-config editor: every category returned by GET /admin/config,
 * not just the 6 keys the dashboard's small "Live Config" panel (useConfigStore)
 * exposes. The "ai" category gets special rendering via AiProviderConfig; every
 * other category renders as plain key/value rows. Key Pool is a separate card
 * below, matching the legacy page (#cfg-sections + #key-pool-section). */
export default function ConfigEditor() {
  const { notify } = useAdmin();
  const [categories, setCategories] = useState<AdminConfigCategories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getConfig();
      setCategories(r.config);
      const initial: Record<string, string> = {};
      Object.values(r.config)
        .flat()
        .forEach((item) => {
          // Secret fields are write-only — never pre-populate a saved value.
          initial[item.key] = item.is_secret ? "" : (item.raw_value ?? "");
        });
      setValues(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const providerStatus = useMemo(() => {
    const status: Record<string, boolean> = { ollama: true };
    const aiItems = categories?.ai || [];
    AI_PROVIDERS.forEach((p) => {
      if (p.keyField) {
        const item = aiItems.find((i) => i.key === p.keyField);
        status[p.id] = Boolean(item?.is_configured);
      }
    });
    return status;
  }, [categories]);

  const handleChange = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  const handleSave = async () => {
    if (!categories) return;
    setSaving(true);
    try {
      const allItems: AdminConfigItem[] = Object.values(categories).flat();
      const updates = allItems
        .filter((item) => {
          if (item.is_secret) return Boolean((values[item.key] ?? "").trim());
          return true;
        })
        .map((item) => ({ key: item.key, value: values[item.key] ?? "" }));
      const r = await saveConfig(updates);
      notify(`${r.updated?.length ?? updates.length} konfigurasi disimpan ke DB`, "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal menyimpan", "e");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset semua konfigurasi ke nilai default?")) return;
    setResetting(true);
    try {
      await resetAllConfig();
      notify("Config direset ke default", "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal reset", "e");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: "0.875rem" }}>
        <button type="button" className="btn-sm" onClick={load} disabled={loading}>
          <i className="bi bi-arrow-clockwise" /> Reload dari DB
        </button>
        <button
          type="button"
          className="btn-sm"
          style={{ color: "#b45309", borderColor: "#fcd34d" }}
          disabled={resetting}
          onClick={handleReset}
        >
          <i className="bi bi-arrow-counterclockwise" /> Reset semua ke default
        </button>
        <button type="button" className="btn-sm primary" disabled={saving || loading} onClick={handleSave}>
          <i className="bi bi-save" /> {saving ? "Menyimpan..." : "Simpan semua perubahan"}
        </button>
      </div>

      {loading && <div className="adm-loading">Memuat config...</div>}
      {!loading && error && <div className="alert alert-danger py-2 px-3 small">{error}</div>}

      {!loading &&
        !error &&
        categories &&
        Object.entries(categories).map(([cat, items]) => (
          <div className="card" style={{ marginBottom: "0.875rem" }} key={cat}>
            <div className="card-header-custom">
              <span>
                <span className={`stat-badge ${CAT_COLORS[cat] || "badge-gray"}`} style={{ marginRight: 6 }}>
                  {cat}
                </span>
                {CAT_LABELS[cat] || cat}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{items.length} keys</span>
            </div>
            <div className="card-body-custom">
              {cat === "ai" ? (
                <AiProviderConfig items={items} values={values} onChange={handleChange} providerStatus={providerStatus} />
              ) : (
                items.map((item) => (
                  <div className="cfg-row" key={item.key}>
                    <span className="cfg-key" title={item.key}>
                      {item.key.split(".").pop()}
                    </span>
                    <div className="cfg-val">
                      {item.is_secret ? (
                        <div className="cfg-secret-wrap">
                          <input
                            type="password"
                            autoComplete="new-password"
                            title={item.description}
                            placeholder={item.is_configured ? "Isi untuk mengganti" : "Belum dikonfigurasi"}
                            value={values[item.key] ?? ""}
                            onChange={(e) => handleChange(item.key, e.target.value)}
                          />
                          <span className={item.is_configured ? "cfg-secret-ok" : "cfg-secret-empty"}>
                            <i className={`bi ${item.is_configured ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />{" "}
                            {item.is_configured ? "Dikonfigurasi" : "Belum diisi"}
                          </span>
                        </div>
                      ) : (
                        <input
                          title={item.description}
                          value={values[item.key] ?? ""}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                        />
                      )}
                    </div>
                    <span className="cfg-type">{item.value_type}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

      <KeyPool />
    </>
  );
}
