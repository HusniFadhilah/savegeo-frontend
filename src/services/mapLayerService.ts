import { apiClient } from "@/services/apiClient";
import { DEFAULT_BASEMAP_ID, FALLBACK_BASEMAPS } from "@/config/basemaps";
import type { BasemapDefinition } from "@/types/map";

interface BasemapRegistryLayer {
  key: string;
  name: string;
  tile_url: string;
  overlay_tile_url?: string | null;
  labels_tile_url?: string | null;
  labels_attribution?: string | null;
  wmts?: BasemapDefinition["wmts"];
  attribution: string;
  overlay_attribution?: string | null;
  max_zoom?: number;
  enabled: boolean;
  is_default?: boolean;
  order?: number;
}

/** GET /basemaps and /map-layers return `{layers: [...], count}` directly - no {success,data} envelope (verified against app/api/routes/maps.py + live response). */
interface LayerRegistryResponse<T> {
  layers: T[];
  count: number;
}

/**
 * Satellite is always the effective default: if the registry doesn't flag
 * one, we force the `satellite` key (or first entry) default rather than
 * trusting arbitrary registry order. On any failure (network, empty,
 * malformed) falls back to the static Satellite/Roads pair in
 * config/basemaps.ts so a dead backend never demotes the default basemap.
 */
export async function fetchBasemaps(): Promise<BasemapDefinition[]> {
  try {
    const res = await apiClient.get<LayerRegistryResponse<BasemapRegistryLayer>>("/basemaps");
    const layers = res.layers?.filter((l) => l.enabled) ?? [];
    if (!layers.length) return FALLBACK_BASEMAPS;

    const mapped: BasemapDefinition[] = layers
      .map((l, idx) => ({
        id: l.key,
        name: l.name,
        url: l.tile_url,
        overlayUrl: l.overlay_tile_url || undefined,
        labelsUrl: l.labels_tile_url || undefined,
        labelsAttribution: l.labels_attribution || undefined,
        wmts: l.wmts,
        attribution: l.attribution,
        overlayAttribution: l.overlay_attribution || undefined,
        maxZoom: Math.max(l.max_zoom || 19, l.key === DEFAULT_BASEMAP_ID ? 22 : l.max_zoom || 19),
        maxNativeZoom: l.key === DEFAULT_BASEMAP_ID ? Math.min(l.max_zoom || 19, 18) : l.max_zoom || 19,
        isDefault: Boolean(l.is_default),
        order: l.order ?? idx,
      }))
      .sort((a, b) => a.order - b.order);

    if (!mapped.some((b) => b.isDefault)) {
      const satellite = mapped.find((b) => b.id === DEFAULT_BASEMAP_ID);
      (satellite ?? mapped[0]).isDefault = true;
    }
    return mapped;
  } catch {
    return FALLBACK_BASEMAPS;
  }
}

export interface ResultLayerDefinition {
  key: string;
  name: string;
  description?: string;
}

export async function fetchMapLayerRegistry(): Promise<ResultLayerDefinition[]> {
  try {
    const res = await apiClient.get<LayerRegistryResponse<ResultLayerDefinition>>("/map-layers");
    return res.layers ?? [];
  } catch {
    return [];
  }
}
