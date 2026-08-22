/** Whole days elapsed since `plantingDate` (YYYY-MM-DD), or null if unset/invalid. */
export function daysSincePlanting(plantingDate: string | null | undefined): number | null {
  if (!plantingDate) return null;
  const planted = new Date(plantingDate);
  if (Number.isNaN(planted.getTime())) return null;
  const diffMs = Date.now() - planted.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

interface StatusStyle {
  label: string;
  color: string;
  className: string;
  emoji: string;
}

/** Health label (sub-analysis A) -> Indonesian label/color, same convention
 * as VegStatsTable's cloud-free-% badge (text-success/warning/danger). */
export const HEALTH_LABEL_STYLE: Record<string, StatusStyle> = {
  Good: { label: "Baik", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟡" },
  Poor: { label: "Buruk", color: "#c62828", className: "text-danger", emoji: "🔴" },
};

/** Anomaly category (sub-analysis C). */
export const ANOMALY_CATEGORY_STYLE: Record<string, StatusStyle> = {
  Normal: { label: "Normal", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Watch: { label: "Waspada", color: "#9e9d24", className: "text-warning", emoji: "🟡" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟠" },
  High: { label: "Tinggi", color: "#ef6c00", className: "text-danger", emoji: "🟠" },
  Critical: { label: "Kritis", color: "#c62828", className: "text-danger", emoji: "🔴" },
  Unknown: { label: "Tidak diketahui", color: "#757575", className: "text-muted", emoji: "⚪" },
};

/** Flood severity (sub-analysis G). */
export const FLOOD_SEVERITY_STYLE: Record<string, StatusStyle> = {
  Low: { label: "Rendah", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟡" },
  High: { label: "Tinggi", color: "#ef6c00", className: "text-danger", emoji: "🟠" },
  Critical: { label: "Kritis", color: "#c62828", className: "text-danger", emoji: "🔴" },
  Unknown: { label: "Tidak diketahui", color: "#757575", className: "text-muted", emoji: "⚪" },
};

/** Risk level (sub-analysis J). */
export const RISK_LEVEL_STYLE: Record<string, StatusStyle> = {
  Low: { label: "Rendah", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟡" },
  High: { label: "Tinggi", color: "#ef6c00", className: "text-danger", emoji: "🟠" },
  Critical: { label: "Kritis", color: "#c62828", className: "text-danger", emoji: "🔴" },
  Unknown: { label: "Tidak diketahui", color: "#757575", className: "text-muted", emoji: "⚪" },
};

/** Water stress label (sub-analysis E). */
export const WATER_STRESS_STYLE: Record<string, StatusStyle> = {
  Low: { label: "Rendah", color: "#2e7d32", className: "text-success", emoji: "🟢" },
  Moderate: { label: "Sedang", color: "#f9a825", className: "text-warning", emoji: "🟡" },
  High: { label: "Tinggi", color: "#c62828", className: "text-danger", emoji: "🔴" },
  Unknown: { label: "Tidak diketahui", color: "#757575", className: "text-muted", emoji: "⚪" },
};

const FALLBACK_STYLE: StatusStyle = {
  label: "-",
  color: "#757575",
  className: "text-muted",
  emoji: "⚪",
};

export function styleFor(map: Record<string, StatusStyle>, key: string | null | undefined): StatusStyle {
  if (!key) return FALLBACK_STYLE;
  return map[key] ?? { ...FALLBACK_STYLE, label: key };
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "-";
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(digits)}%` : "-";
}
