import type { AoiPayload } from "@/features/carbon/lib/geo";
import type { MapLegendEntry } from "@/types/map";
import type { Geometry } from "geojson";

/** How a scene-tile is rendered - see imagery_provider_registry.py for the full rationale. */
export type ImageryVisualization = "rgb" | "sar" | "single_band";
export type ImagerySourceKind =
  | "gee"
  | "geosave_cdse_stac"
  | "oam_stac"
  | "maxar_open_data_stac"
  | "planet_open_data_stac"
  | "generic_stac"
  | "big_ctsrt";

/**
 * One entry from GET /imagery/providers - deliberately its OWN type, not
 * reused from vegetation/types.ts's SatelliteProvider: that one assumes every
 * entry has optical red/green/blue bands for vegetation-index math, which
 * doesn't hold for Sentinel-1 (SAR, no true color) or Sentinel-5P (single
 * gas-concentration band, no RGB at all).
 */
export interface ImageryProvider {
  key: string;
  name: string;
  provider: string;
  /** Dropdown subgroup label (e.g. "Optik", "Radar (SAR)", "Atmosfer (Gas)", "Malam Hari (Night Lights)"). */
  group: string;
  gee_collection: string;
  source_kind?: ImagerySourceKind;
  stac_collection?: string;
  visualization: ImageryVisualization;
  /** "rgb" only - "natural" (true color) or "false_color" (e.g. ASTER: NIR-Red-Green, since it has no blue band). Absent for non-rgb visualizations. */
  color_mode?: "natural" | "false_color";
  description?: string;
  resolution_m: number;
  revisit_days: number;
  start_year: number;
  /** GEE scene-level property name for cloud %, or null if this sensor has no such concept (SAR, gas products, night-lights) - drives whether the cloud-filter UI shows at all. */
  cloud_property: string | null;
  /** "single_band" only - physical unit of the mapped quantity (e.g. "mol/m²", "ppb", "nW/cm²/sr"). */
  unit?: string;
  /** Per-pixel cloud-MASKING techniques this provider's scene-tile supports (Sentinel-2 only: L2A has all 3, L1C/TOA lacks "scl" - no SCL band on that product). null/absent = masking not offered, only the scene-level max_cloud_cover FILTER applies (if cloud_property is set at all). */
  cloud_mask_techniques?: string[] | null;
}

export interface ImageryProviderCatalogResponse {
  providers: Record<string, ImageryProvider>;
  default: string;
}

export interface ImageryStacAssetOption {
  key: string;
  title?: string | null;
  href: string;
  type?: string | null;
  roles?: string[];
  resolution_m?: number | null;
}

/** One real satellite scene as returned by POST /imagery/scenes - no compositing, exact acquisition timestamp (with time-of-day). */
export interface ImageryScene {
  /** GEE `system:index` - stable id for fetching this exact scene's tile. */
  id: string;
  /** ISO 8601 UTC, e.g. "2023-06-28T03:19:45.094Z" - real overpass time, not just a date. */
  acquired_at: string;
  /** null for sensors with no scene-level cloud property (SAR, gas products) - not "no data". */
  cloud_cover_pct: number | null;
  /** STAC bbox as [west, south, east, north], available for OpenAerialMap. */
  bbox?: [number, number, number, number] | null;
  /** Optional STAC geometry footprint for exact scene outline. */
  footprint?: Geometry | null;
  /** Optional STAC/OpenAerialMap ground sample distance in metres. */
  resolution_m?: number | null;
  platform?: string | null;
  producer?: string | null;
  title?: string | null;
  assets?: ImageryStacAssetOption[];
  default_asset_key?: string | null;
  download_url?: string | null;
}

export interface ImagerySceneListResponse {
  scenes: ImageryScene[];
  count: number;
  satellite: ImageryProvider;
  /** true if results were capped (backend limits to 200 scenes per request). */
  truncated: boolean;
}

export interface ImagerySceneTileResponse {
  scene_id: string;
  tile_url: string;
  satellite: ImageryProvider;
  super_resolution?: ImagerySuperResolutionResult | null;
}

export interface ListScenesParams {
  aoi: AoiPayload;
  satellite: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  maxCloudCover?: number;
  stacCatalogUrl?: string;
  stacCollections?: string;
}

export type SarMode = "grayscale" | "composite";
export type ImagerySuperResolutionMode = "off" | "bicubic_2x" | "bicubic_4x";

export interface ImagerySuperResolutionResult {
  mode: Exclude<ImagerySuperResolutionMode, "off">;
  factor: number;
  native_resolution_m: number;
  render_scale_m: number;
  method: string;
}

export interface GetSceneTileParams {
  satellite: string;
  sceneId: string;
  aoi?: AoiPayload;
  /** Sentinel-1 only - "grayscale" (single VV band) or "composite" (VV/VH/VV-VH false color). Ignored by other providers. */
  sarMode?: SarMode;
  /** Sentinel-2 only (L2A/L1C) - "scl" | "qa60" | "s2cloudless", opt-in per-pixel cloud mask on top of the default raw/unmasked view. Ignored (and silently remapped if unsupported, e.g. "scl" on L1C) by the backend for providers without cloud_mask_techniques. */
  cloudMaskTechnique?: string;
  /** GEE-backed scene tiles only - optional visual super-resolution via backend bicubic resampling. */
  superResolution?: ImagerySuperResolutionMode;
  /** STAC/COG-backed scene tiles only - asset key to render. */
  cogAssetKey?: string;
  /** STAC/COG-backed scene tiles only - one-based band indexes, e.g. "1,2,3". */
  cogBands?: string;
  /** STAC/COG-backed scene tiles only - rio-tiler rescale, e.g. "0,3000" or "0,3000|0,3000|0,3000". */
  cogRescale?: string;
}

export interface DemTileStats {
  min_elevation_m?: number | null;
  mean_elevation_m?: number | null;
  max_elevation_m?: number | null;
}

export interface DemTileResponse {
  tile_url?: string | null;
  wms_url?: string | null;
  wms_layers?: string | null;
  source: string;
  source_kind: "gee_asset" | "xyz" | "wms";
  is_official_demnas: boolean;
  stats?: DemTileStats | null;
  legend?: MapLegendEntry[];
}

export interface GetDemTileParams {
  aoi: AoiPayload;
  scale?: number;
}
