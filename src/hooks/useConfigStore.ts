import { create } from "zustand";
import { apiClient } from "@/services/apiClient";

/**
 * Ports config-manager.js's `AppConfig` singleton. Read-only public runtime
 * config (year range, cloud threshold, carbon vis params) from GET
 * /api/admin/config/public, with the same hardcoded defaults as a fallback
 * when the backend is unreachable. Editing config is admin-only and lives
 * entirely in features/admin/components/ConfigEditor.tsx (the full editor,
 * every category) - this store has no write path, avoid adding one here to
 * prevent re-introducing the duplicate "Live Config" panel that used to sit
 * on the public dashboard.
 */
const DEFAULTS: Record<string, string | number> = {
  "year.min": 2015,
  "year.max": new Date().getFullYear(),
  "year.esri_min": 2017,
  "year.esri_max": 2023,
  "year.esa_threshold": 2021,
  "carbon.co2_factor": 3.67,
  "carbon.vis_min": 0,
  "carbon.vis_max": 200,
  "carbon.vis_palette": "440154,414487,2a788e,22a884,7ad151,fde725",
  "app.name": "SAVEGEO",
  "app.version": "1.0.0",
};

interface ConfigState {
  store: Record<string, string | number>;
  loadedAt: Date | null;
  ready: boolean;
  load: () => Promise<void>;
  get: (key: string, fallback?: string | number | null) => string | number | null;
  getInt: (key: string, fallback?: number) => number;
  getFloat: (key: string, fallback?: number) => number;
  getArray: (key: string, fallback?: string[]) => string[];
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  store: {},
  loadedAt: null,
  ready: false,
  load: async () => {
    try {
      // GET /admin/config/public returns the config dict directly (e.g.
      // {"year.min": 2015, ...}) - no {success,data} envelope (verified
      // against admin.py's config_public route + live curl).
      const res = await apiClient.get<Record<string, string | number>>("/admin/config/public");
      set({ store: { ...DEFAULTS, ...(res ?? {}) }, loadedAt: new Date(), ready: true });
    } catch {
      set({ store: { ...DEFAULTS }, loadedAt: new Date(), ready: true });
    }
  },
  get: (key, fallback = null) => {
    const s = get().store;
    return key in s ? s[key] : (DEFAULTS[key] ?? fallback);
  },
  getInt: (key, fallback = 0) => {
    const v = get().get(key, fallback);
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : fallback;
  },
  getFloat: (key, fallback = 0) => {
    const v = get().get(key, fallback);
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : fallback;
  },
  getArray: (key, fallback = []) => {
    const v = get().get(key);
    if (!v) return fallback;
    return String(v)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  },
}));
