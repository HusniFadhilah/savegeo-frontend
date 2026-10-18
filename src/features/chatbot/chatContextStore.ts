import { create } from "zustand";

/**
 * Typed channel from analysis modules to the assistant's grounding context.
 * Replaces the old `window.analysisResults` / `window.lcChangeState` globals: a
 * module publishes here while mounted and clears on unmount, and
 * `buildGeoAiContext()` reads from here. The active AOI is NOT mirrored here -
 * `useAoiStore` is its single source of truth.
 */
export interface LcChangeContext {
  aoi: GeoJSON.GeoJSON | null;
  dataset: string | null;
  from_year: number | null;
  to_year: number | null;
  transition: {
    dataset: string | null;
    from_year: number | null;
    to_year: number | null;
    gains: Record<string, number>;
    losses: Record<string, number>;
    matrix: Record<string, Record<string, number>>;
  } | null;
}

interface ChatContextStore {
  analysisResults: Record<string, unknown>;
  lcChange: LcChangeContext | null;
  setAnalysisResults: (results: Record<string, unknown>) => void;
  setLcChange: (state: LcChangeContext | null) => void;
}

export const useChatContextStore = create<ChatContextStore>((set) => ({
  analysisResults: {},
  lcChange: null,
  setAnalysisResults: (analysisResults) => set({ analysisResults }),
  setLcChange: (lcChange) => set({ lcChange }),
}));
