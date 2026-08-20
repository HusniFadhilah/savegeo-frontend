import { create } from "zustand";
import type L from "leaflet";
import type { AoiFeature } from "@/types/map";

export type AoiSource = "drawn" | "upload" | "admin" | "coordinate" | "company";

/** Single source of truth for the currently selected AOI, shared across every
 * module (Carbon, LC-Change, Vegetation, ...). Previously each module kept
 * its own local `useState`, so an AOI drawn on one page vanished on
 * navigating to another - see report for the incident this fixed. */
export interface AoiState {
  source: AoiSource;
  name: string;
  areaKm2: number | null;
  feature: AoiFeature;
  bounds: L.LatLngBounds | null;
}

interface AoiStore {
  aoi: AoiState | null;
  setAoi: (aoi: AoiState | null) => void;
}

export const useAoiStore = create<AoiStore>((set) => ({
  aoi: null,
  setAoi: (aoi) => set({ aoi }),
}));
