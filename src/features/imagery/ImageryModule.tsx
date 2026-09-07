import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import MapModeControl from "@/components/map/MapModeControl";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AoiPickerModal from "@/components/map/AoiPickerModal";
import { RESULT_PANE } from "@/config/mapPanes";
import { useAoiStore } from "@/hooks/useAoiStore";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import type { AoiFeature } from "@/types/map";
import { getCloudMaskTechniques } from "@/features/vegetation/api";
import type { CloudMaskTechniqueInfo } from "@/features/vegetation/types";
import { getImageryDemTile, getImageryProviders, getImagerySceneTile, getImageryStacSourceUrl, listImageryScenes } from "./api";
import type { DemTileResponse, ImageryProvider, ImageryScene, ImagerySuperResolutionMode, SarMode } from "./types";
import { listEsriWaybackScenes, type WaybackScene } from "./wayback";
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";
import SamGeoPanel from "./SamGeoPanel";
import ImageryToolsPanel from "./ImageryToolsPanel";

const STAC_EXAMPLES = [
  { name: "Earth Search - Sentinel-2 L2A", url: "https://earth-search.aws.element84.com/v1", collection: "sentinel-2-l2a" },
  { name: "Planetary Computer - Sentinel-2 L2A", url: "https://planetarycomputer.microsoft.com/api/stac/v1", collection: "sentinel-2-l2a" },
  { name: "Planetary Computer - NAIP (Amerika Serikat)", url: "https://planetarycomputer.microsoft.com/api/stac/v1", collection: "naip" },
];

const AOI_STYLE = { color: "#0d6efd", weight: 2, fillOpacity: 0.05 };
const SCENE_TILE_MAX_NATIVE_ZOOM = 19;
const SCENE_TILE_MAX_ZOOM = 23;
const ESRI_WAYBACK_PROVIDER_KEY = "esri_wayback";
const ESRI_WAYBACK_PROVIDER: ImageryProvider = {
  key: ESRI_WAYBACK_PROVIDER_KEY,
  name: "Esri World Imagery Wayback",
  provider: "Esri / World Imagery",
  group: "Basemap Historis",
  gee_collection: "",
  visualization: "rgb",
  color_mode: "natural",
  resolution_m: 1,
  revisit_days: 0,
  start_year: 2014,
  cloud_property: null,
  cloud_mask_techniques: null,
  description:
    "Arsip rilis World Imagery basemap. Tanggal adalah tanggal publikasi Wayback, bukan selalu tanggal akuisisi sensor.",
};
type ViewMode = "single" | "compare";
type DemLayerMode = "none" | "dem" | "3d";

type SceneFootprintProperties = {
  sceneId: string;
  selected: boolean;
  hovered: boolean;
};

function FitToAoi({ aoi }: { aoi: AoiFeature | null }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const bounds = L.geoJSON(aoi as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13 });
  }, [aoi, map]);
  return null;
}

function FitToSceneOrAoi({
  aoi,
  focusKey,
  maxZoom,
  scene,
}: {
  aoi: AoiFeature | null;
  focusKey: string;
  maxZoom: number;
  scene: ImageryScene | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (scene?.bbox && scene.bbox.length === 4) {
      const [west, south, east, north] = scene.bbox;
      const bounds = L.latLngBounds([south, west], [north, east]);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom });
        return;
      }
    }
    if (!aoi) return;
    const bounds = L.geoJSON(aoi as GeoJSON.Feature).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom });
  }, [aoi, focusKey, map, maxZoom, scene]);
  return null;
}

function bboxToPolygon(bbox?: [number, number, number, number] | null): Polygon | null {
  if (!bbox || bbox.length !== 4) return null;
  const [west, south, east, north] = bbox;
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

function sceneGeometry(scene: ImageryScene): Geometry | null {
  return scene.footprint ?? bboxToPolygon(scene.bbox);
}

function sceneFootprintFeatureCollection(
  scenes: ImageryScene[],
  selectedSceneId: string | null,
  hoverSceneId: string | null,
): FeatureCollection<Geometry, SceneFootprintProperties> {
  const features = scenes
    .map((scene): Feature<Geometry, SceneFootprintProperties> | null => {
      const geometry = sceneGeometry(scene);
      if (!geometry) return null;
      return {
        type: "Feature",
        geometry,
        properties: {
          sceneId: scene.id,
          selected: selectedSceneId === scene.id,
          hovered: hoverSceneId === scene.id,
        },
      };
    })
    .filter((feature): feature is Feature<Geometry, SceneFootprintProperties> => Boolean(feature));
  return { type: "FeatureCollection", features };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatAcquired(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function cloudBadgeClass(pct: number | null): string {
  if (pct == null) return "bg-secondary";
  if (pct <= 20) return "bg-success";
  if (pct <= 60) return "bg-warning text-dark";
  return "bg-danger";
}

function formatElevation(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return `${Math.round(Number(value)).toLocaleString("id-ID")} m`;
}

function formatResolution(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return "-";
  if (value < 1) return `${Math.round(value * 100)} cm`;
  return `${value.toLocaleString("id-ID")} m`;
}

function nativeZoomForResolution(resolutionM?: number | null, superResolution: ImagerySuperResolutionMode = "off"): number {
  if (resolutionM == null || Number.isNaN(Number(resolutionM)) || resolutionM <= 0) return SCENE_TILE_MAX_NATIVE_ZOOM;
  const factor = superResolution === "bicubic_4x" ? 4 : superResolution === "bicubic_2x" ? 2 : 1;
  const renderResolutionM = Number(resolutionM) / factor;
  return Math.max(0, Math.min(SCENE_TILE_MAX_ZOOM, Math.ceil(Math.log2(156543.03392 / renderResolutionM))));
}

function SceneFootprintLayer({
  data,
  onHover,
  onSelect,
}: {
  data: FeatureCollection<Geometry, SceneFootprintProperties>;
  onHover: (sceneId: string | null) => void;
  onSelect: (sceneId: string) => void;
}) {
  if (data.features.length === 0) return null;
  return (
    <GeoJSON
      key={JSON.stringify(data.features.map((feature) => [feature.properties.sceneId, feature.properties.selected, feature.properties.hovered]))}
      data={data}
      style={(feature) => {
        const props = feature?.properties as SceneFootprintProperties | undefined;
        return {
          color: props?.selected ? "#ffc107" : props?.hovered ? "#20c997" : "#0dcaf0",
          weight: props?.selected || props?.hovered ? 3 : 1.6,
          fillOpacity: props?.selected ? 0.14 : props?.hovered ? 0.1 : 0.035,
          dashArray: props?.selected ? undefined : "4 4",
        };
      }}
      onEachFeature={(feature, layer) => {
        const props = feature.properties as SceneFootprintProperties | undefined;
        if (!props) return;
        layer.on({
          click: () => onSelect(props.sceneId),
          mouseover: () => onHover(props.sceneId),
          mouseout: () => onHover(null),
        });
      }}
    />
  );
}

function TerrainPreview3D({ tileUrl, source }: { tileUrl?: string | null; source: string }) {
  if (!tileUrl) {
    return (
      <div className="imagery-terrain-3d-empty">
        <i className="bi bi-box" />
        <span>Preview 3D tersedia untuk DEM berbasis tile/asset.</span>
      </div>
    );
  }

  return (
    <div className="imagery-terrain-3d" aria-label={`Preview 3D ${source}`}>
      <div className="imagery-terrain-3d-plane" style={{ backgroundImage: `url("${tileUrl}")` }} />
      <div className="imagery-terrain-3d-grid" />
    </div>
  );
}

/**
 * Raw satellite imagery browser - pick an exact scene by its real acquisition
 * date+time (not a composite over a range) and view it as true-color RGB.
 * Answers the user's direct request: "bagaimana bisa melihat citra satelit
 * utk tanggal beserta jam tertentu, tanpa harus land cover?" - every other
 * module (Vegetation/Carbon/LC-Change) always composites over a date range
 * and only ever exposes month- or (Dynamic World only) day-level granularity;
 * none of them expose a single scene's real overpass time or show it
 * unmodified (no cloud masking - the point here is to look at the scene
 * as-is, clouds included, and judge it yourself).
 */
export default function ImageryModule() {
  const aoiState = useAoiStore((s) => s.aoi);
  const setAoiState = useAoiStore((s) => s.setAoi);
  const aoi: AoiFeature | null = aoiState?.feature ?? null;
  const [aoiModalOpen, setAoiModalOpen] = useState(false);

  const handleAoiChange = useCallback(
    (feature: AoiFeature | null) => {
      if (!feature) {
        setAoiState(null);
        return;
      }
      const bounds = boundsFromGeoJSON(feature);
      setAoiState({ source: "drawn", name: "Poligon Kustom", areaKm2: areaKm2(feature, bounds), feature, bounds });
    },
    [setAoiState],
  );

  const [satellites, setSatellites] = useState<Record<string, ImageryProvider>>({});
  const [satellite, setSatellite] = useState("sentinel2");
  useEffect(() => {
    let cancelled = false;
    getImageryProviders()
      .then((res) => {
        if (cancelled) return;
        setSatellites(res.providers);
        setSatellite(res.default);
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Sentinel-1 only - how to render its scene tile (see imagery_provider_registry.py).
  const [sarMode, setSarMode] = useState<SarMode>("grayscale");

  // Sentinel-2 only (both L2A/L1C) - optional per-pixel cloud mask, reusing
  // the same SCL/QA60/s2cloudless catalog already shared by Vegetation/Carbon.
  const [cloudMaskTechniques, setCloudMaskTechniques] = useState<Record<string, CloudMaskTechniqueInfo>>({});
  const [cloudMaskTechnique, setCloudMaskTechnique] = useState<string>("scl");
  useEffect(() => {
    let cancelled = false;
    getCloudMaskTechniques()
      .then((res) => {
        if (cancelled) return;
        setCloudMaskTechniques(res.techniques);
      })
      .catch(() => {
        /* keep empty - technique dropdown just won't show labels/descriptions */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [startDate, setStartDate] = useState(daysAgoIso(30));
  const [endDate, setEndDate] = useState(todayIso());
  const [cloudFilterEnabled, setCloudFilterEnabled] = useState(false);
  const [maxCloudCover, setMaxCloudCover] = useState(60);
  const [superResolution, setSuperResolution] = useState<ImagerySuperResolutionMode>("bicubic_4x");
  const [stacCatalogUrl, setStacCatalogUrl] = useState("");
  const [stacCollections, setStacCollections] = useState("");
  const [cogAssetKey, setCogAssetKey] = useState("visual");
  const [cogBands, setCogBands] = useState("");
  const [cogRescale, setCogRescale] = useState("");

  const [scenes, setScenes] = useState<ImageryScene[]>([]);
  const [sceneTilesById, setSceneTilesById] = useState<Record<string, string>>({});
  const [truncated, setTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [hoverSceneId, setHoverSceneId] = useState<string | null>(null);
  const [focusSceneId, setFocusSceneId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [tileOpacity, setTileOpacity] = useState(1);
  const [tileLoading, setTileLoading] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);
  const [segmentation, setSegmentation] = useState<FeatureCollection | null>(null);
  const [nasaTimeLayerUrl, setNasaTimeLayerUrl] = useState<string | null>(null);
  const [storyMap, setStoryMap] = useState<FeatureCollection | null>(null);
  const [mapMode, setMapMode] = useState<"flat" | "globe">("flat");
  useEffect(() => { setSegmentation(null); }, [selectedSceneId, satellite, aoi, cogAssetKey, cogBands, cogRescale]);
  const searchRequestRef = useRef(0);
  const tileRequestRef = useRef(0);
  const renderOptionsKeyRef = useRef("");

  // "Bandingkan 2 Waktu" (user request) - swipe/compare slider between two
  // individual scenes (not composites), reusing the same SwipeCompareMap
  // already shared by Carbon/LC-Change - vertical/horizontal + pan-lock come
  // for free from that component.
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [compareSceneAId, setCompareSceneAId] = useState<string | null>(null);
  const [compareSceneBId, setCompareSceneBId] = useState<string | null>(null);
  const [compareOrientation, setCompareOrientation] = useState<SwipeOrientation>("vertical");
  const [compareTileA, setCompareTileA] = useState<string | null>(null);
  const [compareTileB, setCompareTileB] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const [demResult, setDemResult] = useState<DemTileResponse | null>(null);
  const [demLoading, setDemLoading] = useState(false);
  const [demError, setDemError] = useState<string | null>(null);
  const [demLayerMode, setDemLayerMode] = useState<DemLayerMode>("none");

  const imageryProviders = useMemo<Record<string, ImageryProvider>>(
    () => ({ ...satellites, [ESRI_WAYBACK_PROVIDER_KEY]: ESRI_WAYBACK_PROVIDER }),
    [satellites],
  );
  const satelliteMeta = imageryProviders[satellite];
  const isEsriWayback = satellite === ESRI_WAYBACK_PROVIDER_KEY;
  const isCogProvider = Boolean(
    satelliteMeta?.source_kind &&
      ["maxar_open_data_stac", "planet_open_data_stac", "generic_stac"].includes(satelliteMeta.source_kind),
  );
  const isOpenHighResProvider = Boolean(
    satelliteMeta?.source_kind &&
      ["oam_stac", "maxar_open_data_stac", "planet_open_data_stac", "generic_stac"].includes(satelliteMeta.source_kind),
  );
  const supportsSuperResolution = Boolean(satelliteMeta && !isEsriWayback && (!satelliteMeta.source_kind || satelliteMeta.source_kind === "gee"));
  const activeSuperResolution = supportsSuperResolution ? superResolution : "off";
  const renderOptionsKey = `${activeSuperResolution}:${sarMode}:${cloudFilterEnabled ? cloudMaskTechnique : "raw"}:${cogAssetKey}:${cogBands}:${cogRescale}`;
  const sceneTileMaxNativeZoom =
    isOpenHighResProvider
      ? SCENE_TILE_MAX_ZOOM
      : nativeZoomForResolution(satelliteMeta?.resolution_m, activeSuperResolution);
  const sceneFocusMaxZoom = isOpenHighResProvider ? 21 : Math.min(sceneTileMaxNativeZoom, 17);
  useEffect(() => {
    ++tileRequestRef.current;
    setScenes([]);
    setSceneTilesById({});
    setTruncated(false);
    setSearched(false);
    setSearchError(null);
    setSelectedSceneId(null);
    setHoverSceneId(null);
    setFocusSceneId(null);
    setFocusNonce((value) => value + 1);
    setTileUrl(null);
    setTileError(null);
    setTileLoading(false);
    setCompareSceneAId(null);
    setCompareSceneBId(null);
    setCompareTileA(null);
    setCompareTileB(null);
    setCompareError(null);
    setCogAssetKey("visual");
    setCogBands("");
    setCogRescale("");
  }, [satellite]);

  // Fixed group order (SearchableSelect renders a group header whenever an
  // option's group differs from the previous option's - it does NOT sort by
  // group itself, so the array must already come in group order).
  const GROUP_ORDER = [
    "Basemap Historis",
    "Open Aerial",
    "Open Disaster",
    "Custom STAC",
    "Sentinel-2",
    "Landsat",
    "Sentinel-3",
    "ASTER",
    "Sentinel-1",
    "Sentinel-5P",
    "VIIRS",
  ];
  const satelliteOptions = useMemo(() => {
    return Object.values(imageryProviders)
      .sort((a, b) => {
        const gi = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
        return gi !== 0 ? gi : a.name.localeCompare(b.name);
      })
      // Resolution shown right in the option label (user request) - lets you
      // compare sensors at a glance without selecting each one first.
      .map((s) => ({
        value: s.key,
        label: s.key === ESRI_WAYBACK_PROVIDER_KEY ? `${s.name} · sub-meter/variasi` : `${s.name} · ${formatResolution(s.resolution_m)}`,
        group: s.group,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageryProviders]);

  const loadSceneTile = useCallback(
    async (scene: ImageryScene, assetKeyOverride?: string) => {
      const requestId = ++tileRequestRef.current;
      renderOptionsKeyRef.current = renderOptionsKey;
      const effectiveCogAssetKey = assetKeyOverride
        ? assetKeyOverride
        : cogAssetKey || scene.default_asset_key || "visual";
      setSelectedSceneId(scene.id);
      setFocusSceneId(scene.id);
      setFocusNonce((value) => value + 1);
      setTileLoading(true);
      setTileError(null);
      setTileUrl(null);
      try {
        if (isEsriWayback) {
          const waybackTile = sceneTilesById[scene.id] ?? (scene as WaybackScene).tile_url;
          if (!waybackTile) throw new Error("Tile Esri Wayback untuk rilis ini tidak ditemukan.");
          if (requestId !== tileRequestRef.current) return;
          setTileUrl(waybackTile);
          return;
        }
        const res = await getImagerySceneTile({
          satellite,
          sceneId: scene.id,
          aoi: aoi ? { geojson: aoi } : undefined,
          sarMode,
          cloudMaskTechnique: cloudFilterEnabled ? cloudMaskTechnique : undefined,
          superResolution: activeSuperResolution,
          cogAssetKey: isCogProvider ? effectiveCogAssetKey : undefined,
          cogBands: isCogProvider ? cogBands.trim() || undefined : undefined,
          cogRescale: isCogProvider ? cogRescale.trim() || undefined : undefined,
        });
        if (requestId !== tileRequestRef.current) return;
        setTileUrl(res.tile_url);
      } catch (err) {
        if (requestId !== tileRequestRef.current) return;
        setTileError(err instanceof Error ? err.message : "Gagal memuat citra scene ini.");
      } finally {
        if (requestId === tileRequestRef.current) {
          setTileLoading(false);
        }
      }
    },
    [
      activeSuperResolution,
      aoi,
      cloudFilterEnabled,
      cloudMaskTechnique,
      cogAssetKey,
      cogBands,
      cogRescale,
      isCogProvider,
      isEsriWayback,
      renderOptionsKey,
      sarMode,
      satellite,
      sceneTilesById,
    ],
  );

  const searchScenes = async () => {
    if (!aoi) {
      setSearchError("Gambar AOI terlebih dahulu di peta.");
      return;
    }
    if (!startDate || !endDate || startDate >= endDate) {
      setSearchError("Rentang tanggal tidak valid (tanggal awal harus sebelum tanggal akhir).");
      return;
    }
    const requestId = ++searchRequestRef.current;
    ++tileRequestRef.current;
    setSearching(true);
    setSearchError(null);
      setSelectedSceneId(null);
      setHoverSceneId(null);
      setFocusSceneId(null);
      setFocusNonce((value) => value + 1);
      setTileUrl(null);
    setTileError(null);
    setTileLoading(false);
    setSceneTilesById({});
    setCompareSceneAId(null);
    setCompareSceneBId(null);
    setCompareTileA(null);
    setCompareTileB(null);
    setCompareError(null);
    try {
      const res = isEsriWayback
        ? {
            scenes: await listEsriWaybackScenes(startDate, endDate),
            truncated: false,
          }
        : await (async () => {
            // GEE's filterDate end bound is exclusive - bump by 1 day so the
            // end-date the user picked is actually included, matching how every
            // other date-range control in this app (build_date_range) behaves.
            const inclusiveEnd = new Date(endDate);
            inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
            return listImageryScenes({
              aoi: { geojson: aoi },
              satellite,
              startDate,
              endDate: isOpenHighResProvider ? endDate : inclusiveEnd.toISOString().slice(0, 10),
              maxCloudCover: cloudFilterEnabled ? maxCloudCover : undefined,
              stacCatalogUrl: satelliteMeta?.source_kind === "generic_stac" ? stacCatalogUrl.trim() : undefined,
              stacCollections: isCogProvider ? stacCollections.trim() || undefined : undefined,
            });
          })();
      if (requestId !== searchRequestRef.current) return;
      const scenesByNewest = [...res.scenes].sort((a, b) => (a.acquired_at < b.acquired_at ? 1 : -1));
      setScenes(res.scenes);
      if (isEsriWayback) {
        setSceneTilesById(Object.fromEntries((res.scenes as WaybackScene[]).map((scene) => [scene.id, scene.tile_url])));
      }
      setTruncated(res.truncated);
      setSearched(true);
      if (scenesByNewest[0]) {
        const defaultAssetKey = scenesByNewest[0].default_asset_key || "visual";
        setCogAssetKey(defaultAssetKey);
        await loadSceneTile(scenesByNewest[0], defaultAssetKey);
      }
    } catch (err) {
      if (requestId !== searchRequestRef.current) return;
      setSearchError(err instanceof Error ? err.message : "Gagal memuat daftar scene.");
      setScenes([]);
    } finally {
      if (requestId === searchRequestRef.current) {
        setSearching(false);
      }
    }
  };

  const selectScene = (scene: ImageryScene) => {
    const nextAssetKey = scene.default_asset_key || cogAssetKey || "visual";
    if (isCogProvider) setCogAssetKey(nextAssetKey);
    void loadSceneTile(scene, nextAssetKey);
  };

  const loadCompare = async () => {
    if (!compareSceneAId || !compareSceneBId) {
      setCompareError("Pilih Scene A dan Scene B terlebih dahulu.");
      return;
    }
    if (compareSceneAId === compareSceneBId) {
      setCompareError("Scene A dan Scene B harus berbeda.");
      return;
    }
    setCompareLoading(true);
    setCompareError(null);
    setCompareTileA(null);
    setCompareTileB(null);
    try {
      if (isEsriWayback) {
        const tileA = sceneTilesById[compareSceneAId];
        const tileB = sceneTilesById[compareSceneBId];
        if (!tileA || !tileB) throw new Error("Tile Esri Wayback untuk salah satu rilis tidak ditemukan.");
        setCompareTileA(tileA);
        setCompareTileB(tileB);
        return;
      }
      const [resA, resB] = await Promise.all([
        getImagerySceneTile({
          satellite,
          sceneId: compareSceneAId,
          aoi: aoi ? { geojson: aoi } : undefined,
          sarMode,
          cloudMaskTechnique: cloudFilterEnabled ? cloudMaskTechnique : undefined,
          superResolution: activeSuperResolution,
          cogAssetKey: isCogProvider ? cogAssetKey || undefined : undefined,
          cogBands: isCogProvider ? cogBands.trim() || undefined : undefined,
          cogRescale: isCogProvider ? cogRescale.trim() || undefined : undefined,
        }),
        getImagerySceneTile({
          satellite,
          sceneId: compareSceneBId,
          aoi: aoi ? { geojson: aoi } : undefined,
          sarMode,
          cloudMaskTechnique: cloudFilterEnabled ? cloudMaskTechnique : undefined,
          superResolution: activeSuperResolution,
          cogAssetKey: isCogProvider ? cogAssetKey || undefined : undefined,
          cogBands: isCogProvider ? cogBands.trim() || undefined : undefined,
          cogRescale: isCogProvider ? cogRescale.trim() || undefined : undefined,
        }),
      ]);
      setCompareTileA(resA.tile_url);
      setCompareTileB(resB.tile_url);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : "Gagal memuat salah satu citra scene.");
    } finally {
      setCompareLoading(false);
    }
  };

  const loadDemTerrain = async (mode: Exclude<DemLayerMode, "none">) => {
    if (!aoi) {
      setDemError("Pilih AOI terlebih dahulu sebelum memuat DEMNAS/3D.");
      return;
    }
    setDemLayerMode(mode);
    if (demResult) {
      setDemError(null);
      return;
    }
    setDemLoading(true);
    setDemError(null);
    setDemResult(null);
    try {
      const res = await getImageryDemTile({ aoi: { geojson: aoi }, scale: 30 });
      setDemResult(res);
    } catch (err) {
      setDemError(err instanceof Error ? err.message : "Gagal memuat DEM/terrain.");
    } finally {
      setDemLoading(false);
    }
  };

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => (a.acquired_at < b.acquired_at ? 1 : -1)),
    [scenes],
  );
  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  );
  const focusScene = useMemo(
    () => scenes.find((s) => s.id === focusSceneId) ?? selectedScene,
    [focusSceneId, scenes, selectedScene],
  );
  const selectedSceneAssets = selectedScene?.assets ?? [];
  const activeCogAsset = selectedSceneAssets.find((asset) => asset.key === cogAssetKey) ?? selectedSceneAssets[0] ?? null;
  const activeCogDownloadUrl = selectedScene && activeCogAsset ? getImageryStacSourceUrl(selectedScene.id, activeCogAsset.key) : null;
  const footprintData = useMemo(
    () => sceneFootprintFeatureCollection(sortedScenes, selectedSceneId, hoverSceneId),
    [hoverSceneId, selectedSceneId, sortedScenes],
  );
  const zoomToScene = (scene: ImageryScene) => {
    setFocusSceneId(scene.id);
    setFocusNonce((value) => value + 1);
  };
  useEffect(() => {
    if (!selectedScene) {
      renderOptionsKeyRef.current = renderOptionsKey;
      return;
    }
    if (renderOptionsKeyRef.current === renderOptionsKey) return;
    renderOptionsKeyRef.current = renderOptionsKey;
    void loadSceneTile(selectedScene);
  }, [loadSceneTile, renderOptionsKey, selectedScene]);

  const mapLayerOptions = useMemo(
    () => [
      {
        id: "demnas",
        name: demLoading && demLayerMode === "dem" ? "DEMNAS..." : "DEMNAS",
        active: demLayerMode === "dem",
        disabled: demLoading,
        onClick: () => void loadDemTerrain("dem"),
      },
      {
        id: "terrain3d",
        name: demLoading && demLayerMode === "3d" ? "3D..." : "3D Terrain",
        active: demLayerMode === "3d",
        disabled: demLoading,
        onClick: () => void loadDemTerrain("3d"),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demLayerMode, demLoading, demResult, aoi],
  );

  return (
    <div className="analysis-page analysis-page-imagery">
      <section className="analysis-hero analysis-hero-imagery" aria-labelledby="imageryHeroTitle">
        <div className="analysis-hero-main">
          <span className="analysis-eyebrow">Citra Satelit</span>
          <h1 id="imageryHeroTitle">Eksplorasi Scene Satelit</h1>
          <p>
            Cari scene berdasarkan tanggal akuisisi (optik: Sentinel-2/3, Landsat 8/9; radar: Sentinel-1; gas atmosfer:
            Sentinel-5P), lalu tampilkan citra asli, layer DEMNAS, 3D terrain, atau bandingkan dua scene.
          </p>
        </div>
        <div className="analysis-hero-status">
          <div className="analysis-status-card">
            <i className="bi bi-bounding-box-circles" />
            <div>
              <span>AOI</span>
              <strong>{aoi ? aoi.geometry.type : "Belum digambar"}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-globe2" />
            <div>
              <span>Satelit</span>
              <strong>{satelliteMeta?.name ?? satellite}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-images" />
            <div>
              <span>Scene</span>
              <strong>{searched ? `${sortedScenes.length} ditemukan` : "Belum dicari"}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="row g-3">
        <div className="col-lg-3">
        <div className="sidebar">
          <h5 className="mb-3">
            <i className="fas fa-camera" /> Citra Satelit
          </h5>
          <p className="text-muted small">
            Lihat citra mentah satu scene asli (bukan komposit) beserta tanggal dan jam akuisisi persisnya - tanpa
            analisis tutupan lahan/vegetasi/karbon.
          </p>

          <div className="mb-3">
            <label className="form-label fw-bold">
              <i className="fas fa-map-marker-alt" /> Area of Interest
            </label>
            {aoi ? (
              <div className="alert alert-success py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-check-circle" /> AOI tergambar ({aoi.geometry.type})
              </div>
            ) : (
              <div className="alert alert-warning py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-exclamation-triangle" /> Pilih AOI lewat modal peta.
              </div>
            )}
            <button type="button" className="btn btn-sm btn-outline-success w-100 mt-2" onClick={() => setAoiModalOpen(true)}>
              <i className="bi bi-bounding-box-circles" /> Pilih/Gambar AOI
            </button>
            {aoi && (
              <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => setAoiState(null)}>
                <i className="fas fa-eraser" /> Hapus AOI
              </button>
            )}
          </div>

          <hr />

          <div className="mb-3">
            <label className="form-label fw-bold" htmlFor="imagerySatellite">
              <i className="fas fa-satellite" /> Satelit
            </label>
            <SearchableSelect
              id="imagerySatellite"
              value={satellite}
              onChange={setSatellite}
              options={satelliteOptions}
            />
            {satelliteMeta && (
              <>
                <small className="text-muted d-block mt-1">
                  {isEsriWayback
                    ? "Resolusi bervariasi (sering sub-meter hingga beberapa meter) · arsip rilis basemap sejak 2014"
                    : `${satelliteMeta.resolution_m}m · revisit ~${satelliteMeta.revisit_days} hari · sejak ${satelliteMeta.start_year}`}
                </small>
                {isEsriWayback && (
                  <div className="alert alert-info py-1 px-2 mt-2 mb-0" style={{ fontSize: ".75rem" }}>
                    <i className="fas fa-circle-info" /> Tanggal Wayback adalah tanggal rilis/publikasi basemap, bukan
                    tanggal akuisisi scene sensor tunggal. Cocok untuk inspeksi visual historis resolusi tinggi.
                  </div>
                )}
                {(satelliteMeta.visualization !== "rgb" || satelliteMeta.color_mode === "false_color") && (
                  <div className="alert alert-info py-1 px-2 mt-2 mb-0" style={{ fontSize: ".75rem" }}>
                    <i className="fas fa-circle-info" />{" "}
                    {satelliteMeta.visualization === "sar"
                      ? "Radar SAR - bukan foto optik, tidak ada foto RGB asli."
                      : satelliteMeta.color_mode === "false_color"
                        ? "False-color - bukan foto warna natural (tidak ada band biru asli pada sensor ini)."
                        : satelliteMeta.group === "VIIRS"
                          ? `Citra lampu malam (${satelliteMeta.unit ?? "satu-band"}) - bukan foto siang hari.`
                          : `Peta konsentrasi gas (${satelliteMeta.unit ?? "satu-band"}) - bukan foto RGB.`}
                    {satelliteMeta.description ? <span className="d-block mt-1">{satelliteMeta.description}</span> : null}
                  </div>
                )}
              </>
            )}
          </div>

          {satelliteMeta?.source_kind === "generic_stac" && (
            <div className="mb-3">
              <label className="form-label fw-bold" htmlFor="imageryStacExample">Contoh katalog</label>
              <select id="imageryStacExample" className="form-select form-select-sm mb-2"
                value={STAC_EXAMPLES.findIndex((item) => item.url === stacCatalogUrl && item.collection === stacCollections)}
                onChange={(event) => {
                  const example = STAC_EXAMPLES[Number(event.target.value)];
                  if (example) { setStacCatalogUrl(example.url); setStacCollections(example.collection); }
                  else { setStacCatalogUrl(""); setStacCollections(""); }
                }}>
                <option value={-1}>URL sendiri</option>
                {STAC_EXAMPLES.map((example, index) => <option key={example.name} value={index}>{example.name}</option>)}
              </select>
              <label className="form-label fw-bold" htmlFor="imageryStacCatalogUrl">
                <i className="bi bi-diagram-3" /> STAC Catalog/API
              </label>
              <input
                id="imageryStacCatalogUrl"
                type="url"
                className="form-control form-control-sm"
                value={stacCatalogUrl}
                onChange={(e) => setStacCatalogUrl(e.target.value)}
                placeholder="https://example.org/catalog.json"
              />
              {STAC_EXAMPLES.some((item) => item.url === stacCatalogUrl) && (
                <a className="small d-block mt-1 text-break" href={stacCatalogUrl} target="_blank" rel="noreferrer">{stacCatalogUrl}</a>
              )}
            </div>
          )}

          {isCogProvider && (
            <div className="mb-3">
              <label className="form-label fw-bold" htmlFor="imageryStacCollections">
                <i className="bi bi-collection" /> Koleksi STAC
              </label>
              <input
                id="imageryStacCollections"
                type="text"
                className="form-control form-control-sm"
                value={stacCollections}
                onChange={(e) => setStacCollections(e.target.value)}
                placeholder="opsional, pisahkan koma"
              />
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-bold" htmlFor="imagerySuperResolution">
              <i className="bi bi-stars" /> Super Resolution
            </label>
            <SearchableSelect
              id="imagerySuperResolution"
              value={activeSuperResolution}
              onChange={(value) => setSuperResolution(value as ImagerySuperResolutionMode)}
              disabled={!supportsSuperResolution}
              options={[
                { value: "off", label: "Nonaktif" },
                { value: "bicubic_2x", label: "Bicubic 2x" },
                { value: "bicubic_4x", label: "Bicubic 4x" },
              ]}
            />
            <small className="text-muted d-block mt-1">
              {supportsSuperResolution
                ? "Diterapkan backend saat tile scene dimuat; meningkatkan kehalusan visual tanpa mengubah sumber data asli."
                : "Tidak tersedia untuk provider ini karena tile tidak dirender ulang oleh backend GEE."}
            </small>
          </div>

          {isCogProvider && (
            <div className="mb-3">
              <label className="form-label fw-bold" htmlFor="imageryCogAsset">
                <i className="bi bi-sliders" /> COG Render Settings
              </label>
              <SearchableSelect
                id="imageryCogAsset"
                value={cogAssetKey}
                onChange={setCogAssetKey}
                disabled={selectedSceneAssets.length === 0}
                options={
                  selectedSceneAssets.length > 0
                    ? selectedSceneAssets.map((asset) => ({
                        value: asset.key,
                        label: `${asset.title || asset.key}${asset.resolution_m ? ` - ${formatResolution(asset.resolution_m)}` : ""}`,
                      }))
                    : [{ value: cogAssetKey, label: cogAssetKey || "visual" }]
                }
              />
              <div className="row g-2 mt-1">
                <div className="col-5">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={cogBands}
                    onChange={(e) => setCogBands(e.target.value)}
                    placeholder="Band 1,2,3"
                  />
                </div>
                <div className="col-7">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={cogRescale}
                    onChange={(e) => setCogRescale(e.target.value)}
                    placeholder="Rescale 0,3000"
                  />
                </div>
              </div>
              <small className="text-muted d-block mt-1">
                {activeCogAsset ? `Asset aktif: ${activeCogAsset.key}` : "Pilih scene untuk melihat asset COG yang tersedia."}
              </small>
              {activeCogDownloadUrl && (
                <a className="btn btn-sm btn-outline-success w-100 mt-2" href={activeCogDownloadUrl} target="_blank" rel="noreferrer">
                  <i className="bi bi-download" /> Download Asset Aktif
                </a>
              )}
            </div>
          )}

          <SamGeoPanel scene={isCogProvider ? selectedScene : null} aoi={aoi}
            assetKey={cogAssetKey} bands={cogBands} rescale={cogRescale}
            onResult={setSegmentation} />

          {satelliteMeta?.visualization === "sar" && (
            <div className="mb-3">
              <label className="form-label fw-bold">
                <i className="fas fa-satellite-dish" /> Mode Tampilan SAR
              </label>
              <div className="btn-group btn-group-sm w-100" role="group">
                <button
                  type="button"
                  className={`btn ${sarMode === "grayscale" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setSarMode("grayscale")}
                >
                  Grayscale (VV)
                </button>
                <button
                  type="button"
                  className={`btn ${sarMode === "composite" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setSarMode("composite")}
                >
                  Komposit Warna
                </button>
              </div>
              <small className="text-muted d-block mt-1">
                Grayscale: intensitas pantulan VV saja. Komposit: R=VV, G=VH, B=selisih VV−VH (kombinasi umum untuk
                membedakan tutupan lahan).
              </small>
            </div>
          )}

          <div className="mb-3">
            <label className="form-label fw-bold">
              <i className="fas fa-calendar" /> Rentang Tanggal
            </label>
            <div className="d-flex align-items-center gap-2">
              <input
                type="date"
                className="form-control form-control-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
              <span className="text-muted">–</span>
              <input
                type="date"
                className="form-control form-control-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={todayIso()}
              />
            </div>
            <small className="text-muted">
              {isEsriWayback
                ? "Rilis World Imagery Wayback di rentang ini akan dicari (maks. 200 hasil)."
                : "Semua scene asli di rentang ini akan dicari (maks. 200 hasil)."}
            </small>
          </div>

          {satelliteMeta?.cloud_property ? (
            <div className="mb-3">
              <div className="form-check form-switch mb-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="imageryCloudFilterSwitch"
                  checked={cloudFilterEnabled}
                  onChange={(e) => setCloudFilterEnabled(e.target.checked)}
                />
                <label className="form-check-label fw-bold" htmlFor="imageryCloudFilterSwitch">
                  <i className="fas fa-cloud" /> Filter Tutupan Awan
                </label>
              </div>
              {cloudFilterEnabled && (
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="range"
                    className="form-range"
                    min={0}
                    max={100}
                    step={5}
                    value={maxCloudCover}
                    onChange={(e) => setMaxCloudCover(Number(e.target.value))}
                  />
                  <span className="badge bg-secondary" style={{ minWidth: 48 }}>
                    ≤{maxCloudCover}%
                  </span>
                </div>
              )}
              {cloudFilterEnabled && satelliteMeta?.cloud_mask_techniques && satelliteMeta.cloud_mask_techniques.length > 0 && (
                <div className="mt-2">
                  <label className="form-label small fw-semibold mb-1">Teknik Masking Awan (opsional)</label>
                  <SearchableSelect
                    value={satelliteMeta.cloud_mask_techniques.includes(cloudMaskTechnique) ? cloudMaskTechnique : satelliteMeta.cloud_mask_techniques[0]}
                    onChange={setCloudMaskTechnique}
                    options={satelliteMeta.cloud_mask_techniques.map((t) => ({
                      value: t,
                      label: cloudMaskTechniques[t]?.label ?? t.toUpperCase(),
                    }))}
                  />
                  <small className="text-muted d-block mt-1">
                    {cloudMaskTechniques[cloudMaskTechnique]?.description ??
                      "Menyamarkan piksel awan pada citra yang ditampilkan (bukan sekadar memfilter daftar scene)."}
                  </small>
                </div>
              )}
              {!cloudFilterEnabled && (
                <small className="text-muted d-block">
                  Nonaktif: semua scene ditampilkan apa adanya (termasuk yang sangat berawan) supaya bisa dinilai sendiri.
                </small>
              )}
            </div>
          ) : (
            satelliteMeta && (
              <small className="text-muted d-block mb-3">
                <i className="fas fa-circle-info" /> Sensor ini tidak punya properti tutupan awan per-scene - filter awan
                tidak berlaku.
              </small>
            )
          )}

          <hr />

          {searchError && (
            <div className="alert alert-danger py-2 mb-2" style={{ fontSize: ".8rem" }}>
              {searchError}
            </div>
          )}

          <button className="btn btn-warning w-100 fw-bold" disabled={searching} onClick={searchScenes}>
            {searching ? (
              <>
                <i className="fas fa-spinner fa-spin" /> Mencari...
              </>
            ) : (
              <>
                <i className="fas fa-search" /> Cari Scene
              </>
            )}
          </button>
          {demError && (
            <div className="alert alert-danger py-2 mt-2 mb-0" style={{ fontSize: ".8rem" }}>
              {demError}
            </div>
          )}
        </div>
      </div>

      <div className="col-lg-9">
        {!searched && (
          <div className="card text-center py-5 border-dashed mb-3">
            <div className="card-body">
              <i className="bi bi-camera text-muted" style={{ fontSize: "3.5rem" }} />
              <h5 className="mt-3 text-muted">Belum Ada Pencarian</h5>
              <p className="text-muted mb-0">
                Gambar AOI, pilih satelit dan rentang tanggal, lalu klik <strong>Cari Scene</strong>
              </p>
            </div>
          </div>
        )}

        {searched && (
          <div className="card mb-3">
            <div className="card-header py-2 d-flex align-items-center gap-2 flex-wrap">
              <span className="fw-semibold">
                <i className="bi bi-list-ul" /> Scene Ditemukan
              </span>
              <span className="badge bg-secondary">{scenes.length}</span>
              {truncated && (
                <span className="badge bg-warning text-dark" title="Hasil dibatasi 200 scene - persempit rentang tanggal untuk melihat semuanya">
                  dibatasi 200
                </span>
              )}
              <div className="btn-group btn-group-sm ms-auto" role="group" aria-label="Mode tampilan">
                <button
                  type="button"
                  className={`btn ${viewMode === "single" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setViewMode("single")}
                >
                  Satu Scene
                </button>
                <button
                  type="button"
                  className={`btn text-white ${viewMode === "compare" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setViewMode("compare")}
                >
                  <i className="fas fa-arrows-alt-h" /> Bandingkan 2 Waktu
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              {scenes.length === 0 ? (
                <div className="p-3 text-center text-muted small">
                  Tidak ada scene ditemukan untuk AOI/rentang/filter ini. Coba perlebar rentang tanggal atau nonaktifkan
                  filter awan.
                </div>
              ) : (
                <div className="table-responsive" style={{ maxHeight: 320, overflowY: "auto" }}>
                  <table className="table table-sm table-hover mb-0">
                    <thead className="table-primary sticky-top">
                      <tr>
                        <th>Tanggal &amp; Jam Akuisisi (UTC)</th>
                        {isOpenHighResProvider && (
                          <>
                            <th>Resolusi</th>
                            <th>Platform</th>
                            <th>Produser</th>
                          </>
                        )}
                        <th>Tutupan Awan</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedScenes.map((scene) => (
                        <tr
                          key={scene.id}
                          className={selectedSceneId === scene.id ? "table-warning" : hoverSceneId === scene.id ? "table-info" : ""}
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => setHoverSceneId(scene.id)}
                          onMouseLeave={() => setHoverSceneId(null)}
                          onClick={() => selectScene(scene)}
                        >
                          <td>
                            {formatAcquired(scene.acquired_at)}
                            {scene.title ? <small className="text-muted d-block">{scene.title}</small> : null}
                          </td>
                          {isOpenHighResProvider && (
                            <>
                              <td>{formatResolution(scene.resolution_m)}</td>
                              <td>{scene.platform ?? "-"}</td>
                              <td>{scene.producer ?? "-"}</td>
                            </>
                          )}
                          <td>
                            <span className={`badge ${cloudBadgeClass(scene.cloud_cover_pct)}`}>
                              {scene.cloud_cover_pct != null ? `${scene.cloud_cover_pct}%` : "-"}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm" role="group" aria-label="Aksi scene">
                              <button
                                type="button"
                                className="btn btn-outline-secondary"
                                title="Zoom ke footprint scene"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  zoomToScene(scene);
                                }}
                              >
                                <i className="bi bi-zoom-in" />
                              </button>
                              {scene.download_url && (
                                <a
                                  className="btn btn-outline-secondary"
                                  href={scene.download_url}
                                  title="Download source scene"
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <i className="bi bi-download" />
                                </a>
                              )}
                              <span className="btn btn-outline-secondary disabled" aria-hidden="true">
                                {selectedSceneId === scene.id ? (
                                  <i className="bi bi-eye-fill text-warning" />
                                ) : (
                                  <i className="bi bi-eye text-muted" />
                                )}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === "single" && (
          <>
            {tileError && <div className="alert alert-danger py-2 mb-3">{tileError}</div>}
            {selectedScene?.cloud_cover_pct != null && selectedScene.cloud_cover_pct > 60 && (
              <div className="alert alert-warning py-2 mb-3 small">
                <i className="bi bi-cloud-haze2 me-1" />
                Scene ini sangat berawan ({selectedScene.cloud_cover_pct}%). Tampilan abu-abu/pudar berasal dari citra
                asli pada tanggal tersebut, bukan komposit bebas awan. Aktifkan Filter Tutupan Awan atau pilih scene
                dengan badge hijau untuk visual yang lebih jelas.
              </div>
            )}
            {tileLoading && (
              <div className="alert alert-info py-2 mb-3">
                <i className="fas fa-spinner fa-spin" /> Memuat citra scene...
              </div>
            )}

            <div className="card">
              <div className="card-header py-2">
                <i className="bi bi-map" /> Peta
                {selectedSceneId && (
                  <span className="text-white small ms-2">
                    - menampilkan scene {formatAcquired(scenes.find((s) => s.id === selectedSceneId)?.acquired_at ?? "")}
                  </span>
                )}
              </div>
              <div className="card-body p-2">
                <MapView id="imagerySceneMap" maxZoom={SCENE_TILE_MAX_ZOOM}>
                  {mapMode === "globe" && <div className="imagery-globe-mode" aria-label="Globe view"><div className="imagery-globe-sphere"><span>Globe view</span></div></div>}
                  <BasemapSwitcher extraOptions={mapLayerOptions} />
                  <MapModeControl mode={mapMode} onChange={setMapMode} />
                  {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
                  <SceneFootprintLayer
                    data={footprintData}
                    onHover={setHoverSceneId}
                    onSelect={(sceneId) => {
                      const scene = scenes.find((item) => item.id === sceneId);
                      if (scene) selectScene(scene);
                    }}
                  />
                  {segmentation && <GeoJSON key={JSON.stringify(segmentation)} data={segmentation}
                    style={{ color: "#e83e8c", weight: 2, fillOpacity: 0.18 }} />}
                  {nasaTimeLayerUrl && <TileLayer key={nasaTimeLayerUrl} url={nasaTimeLayerUrl} opacity={0.55} attribution="NASA GIBS / Earthdata" pane={RESULT_PANE} />}
                  {tileUrl && (
                    <>
                      <TileLayer
                        key={`${selectedSceneId ?? "scene"}:${tileUrl}`}
                        url={tileUrl}
                        opacity={tileOpacity}
                        attribution={
                          satelliteMeta?.source_kind === "oam_stac"
                            ? "OpenAerialMap / HOT"
                            : satelliteMeta?.source_kind === "maxar_open_data_stac"
                              ? "Vantor/Maxar Open Data"
                              : satelliteMeta?.source_kind === "planet_open_data_stac"
                                ? "Planet Open Data"
                                : satelliteMeta?.source_kind === "generic_stac"
                                  ? "STAC/COG source"
                                  : isEsriWayback
                                    ? "Esri World Imagery Wayback"
                                    : "Google Earth Engine"
                        }
                        maxNativeZoom={sceneTileMaxNativeZoom}
                        maxZoom={SCENE_TILE_MAX_ZOOM}
                        pane={RESULT_PANE}
                      />
                      <LayerOpacityControl opacity={tileOpacity} onChange={setTileOpacity} label="Opacity scene" />
                    </>
                  )}
                  {demLayerMode !== "none" && demResult?.tile_url && (
                    <TileLayer url={demResult.tile_url} opacity={0.82} attribution={demResult.source} pane={RESULT_PANE} />
                  )}
                  {demLayerMode !== "none" && demResult?.wms_url && demResult.wms_layers && (
                    <WMSTileLayer
                      url={demResult.wms_url}
                      layers={demResult.wms_layers}
                      format="image/png"
                      transparent
                      opacity={0.82}
                      attribution={demResult.source}
                      pane={RESULT_PANE}
                    />
                  )}
                  <FitToSceneOrAoi
                    aoi={aoi}
                    focusKey={`${focusSceneId ?? "aoi"}:${focusNonce}`}
                    scene={focusScene}
                    maxZoom={sceneFocusMaxZoom}
                  />
                </MapView>
                {demLoading && (
                  <div className="alert alert-info py-2 mt-2 mb-0 small">
                    <i className="fas fa-spinner fa-spin" /> Memuat DEMNAS/3D dari menu layer...
                  </div>
                )}
                {demResult && demLayerMode !== "none" && (
                  <div className="imagery-map-layer-info mt-2">
                    <div>
                      <span className={`badge ${demResult.is_official_demnas ? "bg-success" : "bg-warning text-dark"}`}>
                        {demResult.is_official_demnas ? "BIG DEMNAS" : "Fallback DEM"}
                      </span>
                      <small className="text-muted ms-2">{demResult.source}</small>
                    </div>
                    {demResult.stats && (
                      <div className="imagery-dem-summary">
                        <div>
                          <span>Min</span>
                          <strong>{formatElevation(demResult.stats.min_elevation_m)}</strong>
                        </div>
                        <div>
                          <span>Rata-rata</span>
                          <strong>{formatElevation(demResult.stats.mean_elevation_m)}</strong>
                        </div>
                        <div>
                          <span>Maks</span>
                          <strong>{formatElevation(demResult.stats.max_elevation_m)}</strong>
                        </div>
                      </div>
                    )}
                    {demLayerMode === "3d" && <TerrainPreview3D tileUrl={demResult.tile_url} source={demResult.source} />}
                    {!demResult.is_official_demnas && (
                      <div className="alert alert-warning py-2 mb-0 small">
                        DEMNAS belum dikonfigurasi di backend, sehingga layer ini memakai SRTM sebagai fallback.
                      </div>
                    )}
                  </div>
                )}
                {selectedScene && <ImageryToolsPanel scene={selectedScene} aoi={aoi} assetKey={cogAssetKey}
                  onNasaLayer={setNasaTimeLayerUrl} onStory={setStoryMap} mapMode={mapMode} onMapMode={setMapMode} />}
                {storyMap && <a className="btn btn-sm btn-outline-success mt-2" download="story-map.geojson"
                  href={`data:application/geo+json;charset=utf-8,${encodeURIComponent(JSON.stringify(storyMap))}`}>
                  <i className="bi bi-download" /> Download Story Map GeoJSON
                </a>}
              </div>
            </div>
          </>
        )}

        {viewMode === "compare" && searched && (
          <>
            <div className="card mb-3">
              <div className="card-header py-2">
                <i className="bi bi-arrows-alt-h" /> Pilih 2 Waktu untuk Dibandingkan
              </div>
              <div className="card-body">
                <div className="row g-2 mb-2">
                  <div className="col-sm-6">
                    <label className="form-label small fw-semibold mb-1">Scene A (Sebelum)</label>
                    <SearchableSelect
                      value={compareSceneAId ?? ""}
                      onChange={(v) => setCompareSceneAId(v || null)}
                      options={sortedScenes.map((s) => ({
                        value: s.id,
                        label: `${formatAcquired(s.acquired_at)}${s.cloud_cover_pct != null ? ` · awan ${s.cloud_cover_pct}%` : ""}`,
                      }))}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label small fw-semibold mb-1">Scene B (Sesudah)</label>
                    <SearchableSelect
                      value={compareSceneBId ?? ""}
                      onChange={(v) => setCompareSceneBId(v || null)}
                      options={sortedScenes.map((s) => ({
                        value: s.id,
                        label: `${formatAcquired(s.acquired_at)}${s.cloud_cover_pct != null ? ` · awan ${s.cloud_cover_pct}%` : ""}`,
                      }))}
                    />
                  </div>
                </div>
                {compareError && <div className="alert alert-danger py-2 mb-2">{compareError}</div>}
                <button className="btn btn-warning fw-bold" disabled={compareLoading} onClick={loadCompare}>
                  {compareLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Memuat...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-arrows-alt-h" /> Muat Perbandingan
                    </>
                  )}
                </button>
              </div>
            </div>

            {compareTileA && compareTileB ? (
              <div className="card">
                <div className="card-body p-0">
                  <SwipeCompareMap
                    id="imageryCompareMap"
                    beforeUrl={compareTileA}
                    afterUrl={compareTileB}
                    beforeLabel={formatAcquired(scenes.find((s) => s.id === compareSceneAId)?.acquired_at ?? "")}
                    afterLabel={formatAcquired(scenes.find((s) => s.id === compareSceneBId)?.acquired_at ?? "")}
                    orientation={compareOrientation}
                    onOrientationChange={setCompareOrientation}
                    maxNativeZoom={sceneTileMaxNativeZoom}
                    maxZoom={SCENE_TILE_MAX_ZOOM}
                  >
                    {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} pane={RESULT_PANE} />}
                    <FitToSceneOrAoi
                      aoi={aoi}
                      focusKey={compareSceneAId ?? "compare-aoi"}
                      scene={scenes.find((s) => s.id === compareSceneAId) ?? null}
                      maxZoom={sceneFocusMaxZoom}
                    />
                  </SwipeCompareMap>
                </div>
              </div>
            ) : (
              <div className="card text-center py-5 border-dashed">
                <div className="card-body">
                  <i className="bi bi-arrows-angle-expand text-muted" style={{ fontSize: "2.5rem" }} />
                  <p className="text-muted mb-0 mt-2">Pilih Scene A dan Scene B, lalu klik Muat Perbandingan.</p>
                </div>
              </div>
            )}
          </>
        )}

        </div>
      </div>
      <AoiPickerModal
        open={aoiModalOpen}
        id="imageryAoiModalMap"
        title="Pilih AOI Scene Satelit"
        description="Pilih wilayah administrasi, koordinat, gambar polygon/rectangle, unggah file, atau pilih batas perusahaan."
        aoi={aoiState}
        onAoiChange={setAoiState}
        onClose={() => setAoiModalOpen(false)}
      />
    </div>
  );
}
