import { create } from "zustand";
import { apiClient } from "@/services/apiClient";
import { VIEWER_FEATURE_CODES, type ViewerFeatureCode } from "@/auth/viewerFeatures";

export { VIEWER_FEATURE_CODES as VIEWER_FEATURES };
export type { ViewerFeatureCode };
export interface ViewerFeatureItem {
  code: ViewerFeatureCode;
  name: string;
  description: string;
  enabled: boolean;
}

interface ViewerFeatureState {
  features: ViewerFeatureCode[] | null;
  isLoading: boolean;
  error: string | null;
  load: (refresh?: boolean) => Promise<void>;
  reset: () => void;
}

let pending: Promise<void> | null = null;
let requestGeneration = 0;

export const useViewerFeatures = create<ViewerFeatureState>((set, get) => ({
  features: null,
  isLoading: false,
  error: null,
  load: async (refresh = false) => {
    if (pending) return pending;
    if (get().features !== null && !refresh) return;
    const generation = requestGeneration;
    set({ isLoading: true, error: null });
    const request = apiClient
      .get<{ features: ViewerFeatureItem[] }>("/app/features", { auth: "app" })
      .then((response) => {
        const rows = response?.features;
        if (
          !Array.isArray(rows) ||
          rows.length !== VIEWER_FEATURE_CODES.length ||
          !rows.every((item) =>
            item &&
            typeof item.code === "string" &&
            (VIEWER_FEATURE_CODES as readonly string[]).includes(item.code) &&
            typeof item.enabled === "boolean"
          ) ||
          new Set(rows.map((item) => item.code)).size !== VIEWER_FEATURE_CODES.length
        ) throw new Error("Izin fitur tidak dapat dimuat.");
        if (generation === requestGeneration) {
          set({ features: rows.filter((item) => item.enabled).map((item) => item.code), error: null });
        }
      })
      .catch((error: unknown) => {
        if (generation === requestGeneration) {
          set({ features: [], error: error instanceof Error ? error.message : "Izin fitur tidak dapat dimuat." });
        }
      })
      .finally(() => {
        if (generation === requestGeneration) {
          pending = null;
          set({ isLoading: false });
        }
      });
    pending = request;
    return request;
  },
  reset: () => {
    requestGeneration += 1;
    pending = null;
    set({ features: null, isLoading: false, error: null });
  },
}));

export function featureEnabled(features: ViewerFeatureCode[] | null, code: ViewerFeatureCode): boolean {
  return features === null || features.includes(code);
}
