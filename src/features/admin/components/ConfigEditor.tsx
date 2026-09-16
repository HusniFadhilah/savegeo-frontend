import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getConfig, resetAllConfig, saveConfig } from "../api";
import { AI_PROVIDERS, CAT_COLORS, CAT_LABELS } from "../types";
import type { AdminConfigCategories, AdminConfigItem } from "../types";
import AiProviderConfig from "./AiProviderConfig";
import KeyPool from "./KeyPool";
import { useAdmin } from "../AdminContext";
import { useI18nStore } from "@/hooks/useI18nStore";
import { useAuthStore } from "@/hooks/useAuthStore";
import { hasAdminPermission } from "@/auth/access";

type NumericControl = {
  mode: "range" | "number";
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
};

function isBooleanConfig(item: AdminConfigItem, value: string) {
  const type = item.value_type.toLowerCase();
  const key = item.key.toLowerCase();
  return (
    type === "bool" ||
    type === "boolean" ||
    key.startsWith("enable_") ||
    key.endsWith("_enabled") ||
    key.endsWith(".enabled") ||
    ["true", "false"].includes(value.toLowerCase())
  );
}

function isColorConfig(item: AdminConfigItem, value: string) {
  return /(^|[._-])(color|colour|hex|palette)([._-]|$)/i.test(item.key) || /^#?[0-9a-f]{6}$/i.test(value);
}

function normalizeColor(value: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return "#2e7d32";
}

function isPaletteConfig(item: AdminConfigItem, value: string) {
  return /(^|[._-])palette([._-]|$)/i.test(item.key) || value.split(",").filter((part) => /^#?[0-9a-f]{6}$/i.test(part.trim())).length > 1;
}

function parsePalette(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function serializePalette(colors: string[]) {
  return colors.map((color) => color.trim().replace(/^#/, "")).filter(Boolean).join(",");
}

function getNumericControl(item: AdminConfigItem): NumericControl | null {
  const key = item.key.toLowerCase();
  const type = item.value_type.toLowerCase();
  const numeric = type === "int" || type === "integer" || type === "float" || type === "number";
  if (!numeric) return null;

  if (key.includes("legend_bins")) return { mode: "range", min: 2, max: 20, step: 1, hint: "Jumlah range legenda" };
  if (key.includes("cloud_threshold")) return { mode: "range", min: 0, max: 100, step: 1, hint: "Persentase awan maksimum" };
  if (key.includes("threshold") && !key.includes("esa_threshold")) return { mode: "range", min: 0, max: 100, step: 1 };
  if (key.includes("year") || key.endsWith(".min") || key.endsWith(".max") || key.includes("esri_") || key.includes("esa_")) {
    return { mode: "range", min: 1984, max: new Date().getFullYear() + 1, step: 1, hint: "Tahun" };
  }
  if (key.includes("carbon_scale")) return { mode: "range", min: 1, max: 1000, step: 1 };
  if (key.includes("veg_scale") || key.includes("lc_scale")) return { mode: "range", min: 1, max: 100, step: 1 };
  if (key.includes("num_pixels")) return { mode: "range", min: 100, max: 10000, step: 100 };
  if (key.includes("opacity")) return { mode: "range", min: 0, max: 1, step: 0.05 };
  if (key.includes("max_pixels")) return { mode: "number", step: 1000000, hint: "Bisa memakai format 1e13" };
  return { mode: "number", step: type === "int" || type === "integer" ? 1 : 0.01 };
}

function ConfigValueControl({
  item,
  value,
  onChange,
}: {
  item: AdminConfigItem;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const t = useI18nStore((state) => state.t);
  const numeric = getNumericControl(item);
  const title = item.description;
  const paletteColors = parsePalette(value);

  if (isBooleanConfig(item, value)) {
    const checked = ["true", "1", "yes", "on"].includes(value.toLowerCase());
    return (
      <label className="cfg-switch" title={title}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(item.key, e.target.checked ? "true" : "false")} />
        <span />
        <strong>{checked ? t("admin.active") : t("admin.inactive")}</strong>
      </label>
    );
  }

  if (isPaletteConfig(item, value)) {
    const normalized = paletteColors.length ? paletteColors : ["2e7d32"];
    const updateColor = (index: number, nextColor: string) => {
      const next = [...normalized];
      next[index] = nextColor;
      onChange(item.key, serializePalette(next));
    };
    const removeColor = (index: number) => {
      const next = normalized.filter((_, i) => i !== index);
      onChange(item.key, serializePalette(next.length ? next : ["2e7d32"]));
    };
    return (
      <div className="cfg-palette-control">
        <div className="cfg-palette-pickers">
          {normalized.map((color, index) => (
            <div className="cfg-palette-chip" key={`${index}-${color}`}>
              <input type="color" title={`${title || item.key} #${index + 1}`} value={normalizeColor(color)} onChange={(e) => updateColor(index, e.target.value)} />
              <button type="button" className="cfg-palette-remove" onClick={() => removeColor(index)} aria-label={`Hapus warna ${index + 1}`}>
                <i className="bi bi-x" />
              </button>
            </div>
          ))}
          <button type="button" className="cfg-palette-add" onClick={() => onChange(item.key, serializePalette([...normalized, "2e7d32"]))}>
            <i className="bi bi-plus-lg" /> Warna
          </button>
        </div>
        <input title={title} value={value} onChange={(e) => onChange(item.key, e.target.value)} placeholder="440154,414487,2a788e" />
      </div>
    );
  }

  if (isColorConfig(item, value)) {
    return (
      <div className="cfg-color-control">
        <input type="color" title={title} value={normalizeColor(value)} onChange={(e) => onChange(item.key, e.target.value)} />
        <input title={title} value={value} onChange={(e) => onChange(item.key, e.target.value)} placeholder="#2e7d32" />
      </div>
    );
  }

  if (numeric?.mode === "range") {
    const rangeValue = Number.isFinite(Number(value)) ? Number(value) : numeric.min ?? 0;
    return (
      <div className="cfg-range-control">
        <input
          type="range"
          title={title}
          min={numeric.min}
          max={numeric.max}
          step={numeric.step}
          value={rangeValue}
          onChange={(e) => onChange(item.key, e.target.value)}
          style={{ "--cfg-range-pct": `${((rangeValue - (numeric.min ?? 0)) / ((numeric.max ?? 100) - (numeric.min ?? 0))) * 100}%` } as CSSProperties}
        />
        <input
          type="number"
          title={title}
          min={numeric.min}
          max={numeric.max}
          step={numeric.step}
          value={value}
          onChange={(e) => onChange(item.key, e.target.value)}
        />
      </div>
    );
  }

  if (numeric?.mode === "number") {
    return (
      <input
        type="number"
        title={title}
        step={numeric.step}
        value={value}
        placeholder={numeric.hint}
        onChange={(e) => onChange(item.key, e.target.value)}
      />
    );
  }

  if (item.value_type.toLowerCase() === "json" || value.trim().startsWith("{") || value.trim().startsWith("[")) {
    return <textarea title={title} value={value} onChange={(e) => onChange(item.key, e.target.value)} rows={3} />;
  }

  return <input title={title} value={value} onChange={(e) => onChange(item.key, e.target.value)} />;
}

/** Full admin system-config editor: every category returned by GET /admin/config,
 * not just the 6 keys the dashboard's small "Live Config" panel (useConfigStore)
 * exposes. The "ai" category gets special rendering via AiProviderConfig; every
 * other category renders as plain key/value rows. Key Pool is a separate card
 * below, matching the legacy page (#cfg-sections + #key-pool-section). */
export default function ConfigEditor() {
  const { notify } = useAdmin();
  const { user } = useAuthStore();
  const t = useI18nStore((state) => state.t);
  const [categories, setCategories] = useState<AdminConfigCategories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const canManageKeyPool = hasAdminPermission(user, "secret.read") && hasAdminPermission(user, "secret.write");

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
      setError(err instanceof Error ? err.message : t("admin.config.loadFailed"));
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
      notify(`${r.updated?.length ?? updates.length} ${t("admin.config.saved")}`, "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.saveFailed"), "e");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(t("admin.config.resetConfirm"))) return;
    setResetting(true);
    try {
      await resetAllConfig();
      notify(t("admin.config.resetSuccess"), "s");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.config.resetFailed"), "e");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: "0.875rem" }}>
        <button type="button" className="btn-sm" onClick={load} disabled={loading}>
          <i className="bi bi-arrow-clockwise" /> {t("admin.config.reload")}
        </button>
        <button
          type="button"
          className="btn-sm"
          style={{ color: "#b45309", borderColor: "#fcd34d" }}
          disabled={resetting}
          onClick={handleReset}
        >
          <i className="bi bi-arrow-counterclockwise" /> {t("admin.config.reset")}
        </button>
        <button type="button" className="btn-sm primary" disabled={saving || loading} onClick={handleSave}>
          <i className="bi bi-save" /> {saving ? t("admin.saving") : t("admin.config.saveAll")}
        </button>
      </div>

      {loading && <div className="adm-loading">{t("admin.config.loading")}</div>}
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
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{items.length} {t("admin.config.keys")}</span>
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
                        <ConfigValueControl item={item} value={values[item.key] ?? ""} onChange={handleChange} />
                      )}
                    </div>
                    <span className="cfg-type">{item.value_type}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

      {canManageKeyPool && <KeyPool />}
    </>
  );
}
