import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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

const CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  analysis: "admin.config.category.analysis",
  year: "admin.config.category.year",
  carbon: "admin.config.category.carbon",
  carbon_maps: "admin.config.category.carbonMaps",
  app: "admin.config.category.app",
  maps: "admin.config.category.maps",
  ai: "admin.config.category.ai",
  satellite: "admin.config.category.satellite",
  arcgis: "admin.config.category.arcgis",
  crop_monitoring: "admin.config.category.cropMonitoring",
};

function configItemTranslationKey(item: AdminConfigItem, field: "label" | "description") {
  const poolMatch = item.key.match(/^carbon\.pool\.(agb|bgb|soc|litter|deadwood)\.vis_(min|max|palette)$/);
  if (poolMatch) {
    const [, pool, kind] = poolMatch;
    return `admin.config.carbonPool.${pool}.${kind}.${field}`;
  }
  return `admin.config.item.${item.key}.${field}`;
}

function configItemText(item: AdminConfigItem, field: "label" | "description", t: (key: string) => string) {
  const key = configItemTranslationKey(item, field);
  const localized = t(key);
  return localized === key ? item[field] ?? undefined : localized;
}

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

function isCarbonPaletteConfig(item: AdminConfigItem) {
  return item.key === "carbon.vis_palette" || /^carbon\.pool\.(agb|bgb|soc|litter|deadwood)\.vis_palette$/.test(item.key);
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

const CARBON_PALETTE_PRESETS = [
  {
    id: "viridis",
    label: "Viridis (ramah buta warna)",
    colors: ["440154", "414487", "2a788e", "22a884", "7ad151", "fde725"],
  },
  {
    id: "cividis",
    label: "Cividis (ramah buta warna)",
    colors: ["00204c", "414f79", "697777", "97935f", "c5b54f", "ffea46"],
  },
  {
    id: "plasma",
    label: "Plasma",
    colors: ["0d0887", "5c01a6", "9c179e", "cc4778", "ed7953", "f0f921"],
  },
  {
    id: "inferno",
    label: "Inferno",
    colors: ["000004", "420a68", "932667", "dd513a", "fba40a", "fcffa4"],
  },
  {
    id: "magma",
    label: "Magma",
    colors: ["000004", "3b0f70", "8c2981", "de4968", "fe9f6d", "fcfdbf"],
  },
] as const;

function normalizedPaletteKey(colors: string[]) {
  return colors.map((color) => color.trim().replace(/^#/, "").toLowerCase()).join(",");
}

function getNumericControl(item: AdminConfigItem, t: (key: string) => string): NumericControl | null {
  const key = item.key.toLowerCase();
  const type = item.value_type.toLowerCase();
  const numeric = type === "int" || type === "integer" || type === "float" || type === "number";
  if (!numeric) return null;

  if (key.includes("legend_bins")) return { mode: "range", min: 2, max: 20, step: 1, hint: t("admin.config.hint.legendBins") };
  if (key.includes("cloud_threshold")) return { mode: "range", min: 0, max: 100, step: 1, hint: t("admin.config.hint.cloudThreshold") };
  if (key.includes("threshold") && !key.includes("esa_threshold")) return { mode: "range", min: 0, max: 100, step: 1 };
  if (key.includes("year") || key.endsWith(".min") || key.endsWith(".max") || key.includes("esri_") || key.includes("esa_")) {
    return { mode: "range", min: 1984, max: new Date().getFullYear() + 1, step: 1, hint: t("admin.config.hint.year") };
  }
  if (key.includes("carbon_scale")) return { mode: "range", min: 1, max: 1000, step: 1 };
  if (key.includes("veg_scale") || key.includes("lc_scale")) return { mode: "range", min: 1, max: 100, step: 1 };
  if (key.includes("num_pixels")) return { mode: "range", min: 100, max: 10000, step: 100 };
  if (key.includes("opacity")) return { mode: "range", min: 0, max: 1, step: 0.05 };
  if (key.includes("max_pixels")) return { mode: "number", step: 1000000, hint: t("admin.config.hint.maxPixels") };
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
  const description = configItemText(item, "description", t);
  const numeric = getNumericControl(item, t);
  const title = description;
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
    const presetKey = normalizedPaletteKey(normalized);
    const selectedPreset = CARBON_PALETTE_PRESETS.find(
      (preset) => normalizedPaletteKey([...preset.colors]) === presetKey,
    );
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
        {isCarbonPaletteConfig(item) && (
          <div className="cfg-palette-preset-row">
            <select
              className="form-select form-select-sm"
              aria-label={`Preset palet ${title || item.key}`}
              title="Pilih palet standar matplotlib"
              value={selectedPreset?.id ?? "custom"}
              onChange={(event) => {
                const preset = CARBON_PALETTE_PRESETS.find((option) => option.id === event.target.value);
                if (preset) onChange(item.key, serializePalette([...preset.colors]));
              }}
            >
              <option value="custom">Warna kustom</option>
              {CARBON_PALETTE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <span
              className="cfg-palette-preview"
              aria-label={selectedPreset?.label ?? "Palet warna kustom"}
              style={{
                background: `linear-gradient(90deg, ${normalized.map(normalizeColor).join(", ")})`,
              }}
            />
          </div>
        )}
        <div className="cfg-palette-pickers">
          {normalized.map((color, index) => (
            <div className="cfg-palette-chip" key={`${index}-${color}`}>
              <input type="color" title={`${title || item.key} #${index + 1}`} value={normalizeColor(color)} onChange={(e) => updateColor(index, e.target.value)} />
              <button type="button" className="cfg-palette-remove" onClick={() => removeColor(index)} aria-label={t("admin.config.removeColor", { index: index + 1 })}>
                <i className="bi bi-x" />
              </button>
            </div>
          ))}
          <button type="button" className="cfg-palette-add" onClick={() => onChange(item.key, serializePalette([...normalized, "2e7d32"]))}>
            <i className="bi bi-plus-lg" /> {t("admin.config.addColor")}
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

  const load = useCallback(async () => {
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
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const providerStatus = useMemo(() => {
    const status: Record<string, boolean> = {};
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
      if (r.errors?.length) {
        const firstError = r.errors[0];
        notify(`${r.updated?.length ?? 0} ${t("admin.config.saved")}; ${r.errors.length} gagal (${firstError.key}: ${firstError.error})`, "e");
      } else {
        notify(`${r.updated?.length ?? updates.length} ${t("admin.config.saved")}`, "s");
      }
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
                  {CATEGORY_TRANSLATION_KEYS[cat] ? t(CATEGORY_TRANSLATION_KEYS[cat]) : CAT_LABELS[cat] || cat}
                </span>
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{items.length} {t("admin.config.keys")}</span>
            </div>
            <div className="card-body-custom">
              {cat === "ai" ? (
                <AiProviderConfig items={items} values={values} onChange={handleChange} providerStatus={providerStatus} />
              ) : (
                items.map((item) => (
                  <div className="cfg-row" key={item.key}>
                    <span className="cfg-key" title={configItemText(item, "description", t) || item.key}>
                      {configItemText(item, "label", t) || item.key.split(".").pop()}
                    </span>
                    <div className="cfg-val">
                      {item.is_secret ? (
                        <div className="cfg-secret-wrap">
                          <input
                            type="password"
                            autoComplete="new-password"
                            title={configItemText(item, "description", t)}
                            placeholder={item.is_configured ? t("admin.config.secretReplacePlaceholder") : t("admin.config.secretMissingPlaceholder")}
                            value={values[item.key] ?? ""}
                            onChange={(e) => handleChange(item.key, e.target.value)}
                          />
                          <span className={item.is_configured ? "cfg-secret-ok" : "cfg-secret-empty"}>
                            <i className={`bi ${item.is_configured ? "bi-check-circle-fill" : "bi-exclamation-circle-fill"}`} />{" "}
                            {item.is_configured ? t("admin.config.configured") : t("admin.config.empty")}
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
