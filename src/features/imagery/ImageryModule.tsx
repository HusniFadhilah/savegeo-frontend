import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { nativeZoomForResolution } from "@/config/mapZoom";
import RasterResolutionNotice from "@/components/map/RasterResolutionNotice";
import ParentFallbackTileLayer from "@/components/map/ParentFallbackTileLayer";
import MapView from "@/components/map/MapView";
import BasemapSwitcher from "@/components/map/BasemapSwitcher";
import SwipeCompareMap, { type SwipeOrientation } from "@/components/map/SwipeCompareMap";
import LayerOpacityControl from "@/components/map/LayerOpacityControl";
import { useGlobeQuery, writeGlobeQuery } from "@/components/map/globe3d/query";
import GlobeView, { type GlobeLayer } from "@/components/map/GlobeView";
import SearchableSelect from "@/components/ui/SearchableSelect";
import AoiPickerModal from "@/components/map/AoiPickerModal";
import { RESULT_PANE } from "@/config/mapPanes";
import { useAoiStore } from "@/hooks/useAoiStore";
import { useI18nStore } from "@/hooks/useI18nStore";
import { boundsFromGeoJSON, areaKm2 } from "@/features/carbon/lib/geo";
import type { AoiFeature } from "@/types/map";
import { getCloudMaskTechniques } from "@/features/vegetation/api";
import type { CloudMaskTechniqueInfo } from "@/features/vegetation/types";
import { getImageryAdvancedCapabilities, getImageryAssetUrl, getImageryDemTile, getImageryProviders, getImagerySceneTile, listImageryScenes } from "./api";
import { getImageryUiCapabilities } from "./providerCapabilities";
import type { AdvancedImageryCapabilities, DemTileResponse, ImageryProvider, ImageryScene, ImagerySuperResolutionMode, SarMode } from "./types";
import { ESRI_WAYBACK_START_DATE, listEsriWaybackScenes, type WaybackScene } from "./wayback";
import { registerUiCommands } from "@/features/chatbot/uiCommandBus";
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";
import SamGeoPanel from "./SamGeoPanel";
import ImageryToolsPanel from "./ImageryToolsPanel";
import { himawariTileUrlFromSceneId, listHimawariScenes } from "./himawari";
import { parseQuery, updateUrlFromState } from "./lib/imageryQueryState";
import GpuEnhancedTileLayer from "./GpuEnhancedTileLayer";
import { useGpuSuperResolution } from "./hooks/useGpuSuperResolution";

const STAC_EXAMPLES = [
  { name: "Earth Search - Sentinel-2 L2A", url: "https://earth-search.aws.element84.com/v1", collection: "sentinel-2-l2a" },
  { name: "Planetary Computer - Sentinel-2 L2A", url: "https://planetarycomputer.microsoft.com/api/stac/v1", collection: "sentinel-2-l2a" },
  { name: "Planetary Computer - NAIP (Amerika Serikat)", url: "https://planetarycomputer.microsoft.com/api/stac/v1", collection: "naip" },
];

const SATELLITE_PREVIEW_ASSETS = {
  esriWayback: {
    thumbnail: "/images/satellite-examples/esri-wayback.jpg",
    alt: "Contoh tile Esri World Imagery Wayback di Jakarta",
    description: "Wayback Jakarta · rilis 5 Agu 2026 · Esri & mitra",
  },
  bigCtsrt: {
    thumbnail: "/images/satellite-examples/big-ctsrt.jpg",
    alt: "Citra tegak CTSRT 2022 dari wilayah Solo, Jawa Tengah",
    description: "Solo, Jawa Tengah · CTSRT 2022 · Badan Informasi Geospasial",
  },
  himawari: {
    thumbnail: "/images/satellite-examples/himawari9.jpg",
    alt: "Cuaca full-disk Himawari-9 di sekitar Asia Timur",
    description: "JMA Himawari-9 · 7 Okt 2026, 00:20 UTC",
  },
  sentinel2: {
    thumbnail: "/images/satellite-examples/sentinel2.jpg",
    alt: "Contoh citra Sentinel-2 dari Tonga",
    description: "Contoh nyata · Tonga, 2016 · Copernicus/ESA · CC BY-SA 3.0 IGO",
  },
  sentinel1: {
    thumbnail: "/images/satellite-examples/sentinel1.jpg",
    alt: "Komposit radar Sentinel-1 untuk banjir di Emilia-Romagna",
    description: "Emilia-Romagna · 2024 · Copernicus Sentinel-1 SAR",
  },
  sentinel3: {
    thumbnail: "/images/satellite-examples/sentinel3.jpg",
    alt: "Bloom fitoplankton dari Sentinel-3 OLCI di lepas Brittany",
    description: "Brittany · 11 Mei 2024 · Sentinel-3 OLCI / EUMETSAT",
  },
  sentinel5pNo2: {
    thumbnail: "/images/satellite-examples/sentinel5p-no2.jpg",
    alt: "Konsentrasi nitrogen dioksida Sentinel-5P di Eropa",
    description: "NO₂ · Eropa, 22 Mar 2022 · Copernicus Sentinel-5P",
  },
  sentinel5pCo: {
    thumbnail: "/images/satellite-examples/sentinel5p-co.jpg",
    alt: "Konsentrasi karbon monoksida Sentinel-5P dari kebakaran Siberia",
    description: "CO · Siberia, 1 Agu 2021 · Copernicus Sentinel-5P",
  },
  sentinel5pCh4: {
    thumbnail: "/images/satellite-examples/sentinel5p-ch4.jpg",
    alt: "Pengukuran metana Sentinel-5P di area tambang batu bara Shanxi",
    description: "CH₄ · Shanxi, 2018 & 2020 · ESA/TROPOMI",
  },
  sentinel5pO3: {
    thumbnail: "/images/satellite-examples/sentinel5p-o3.jpg",
    alt: "Peta kolom ozon global dari Sentinel-5P",
    description: "O₃ · global, 5 Mei 2024 · DLR/BIRA/TROPOMI",
  },
  sentinel5pAerosol: {
    thumbnail: "/images/satellite-examples/sentinel5p-aerosol.jpg",
    alt: "Indeks aerosol Sentinel-5P dari asap kebakaran California",
    description: "Aerosol · California, 30 Agu 2021 · ESA/TROPOMI",
  },
  aster: {
    thumbnail: "/images/satellite-examples/aster.jpg",
    alt: "Komposit false-color ASTER di Gunung St. Helens",
    description: "Gunung St. Helens · 15 Mar 2005 · NASA/ASTER",
  },
  landsat4: {
    thumbnail: "/images/satellite-examples/landsat4.jpg",
    alt: "Citra Landsat 4 first-light di sekitar Danau Erie",
    description: "Danau Erie · 25 Jul 1982 · USGS/NASA Landsat 4",
  },
  landsat5: {
    thumbnail: "/images/satellite-examples/landsat5.jpg",
    alt: "Komposit inframerah Landsat 5 di Gunung Kosciuszko",
    description: "Kosciuszko · 8 Feb 1991 · NASA Landsat 5",
  },
  landsat7: {
    thumbnail: "/images/satellite-examples/landsat7.jpg",
    alt: "Scene Landsat 7 di Lake District, Inggris",
    description: "Lake District · 7 Mei 2000 · NASA Landsat 7",
  },
  landsat8: {
    thumbnail: "/images/satellite-examples/landsat8.jpg",
    alt: "Contoh citra Landsat 8 Earth as Art dari USGS",
    description: "Contoh nyata · Earth as Art · USGS · Public Domain",
  },
  landsat9: {
    thumbnail: "/images/satellite-examples/landsat9.png",
    alt: "Contoh citra Landsat 9 di Amazon, Peru",
    description: "Contoh nyata · Amazon, Peru · Landsat 9 / NASA",
  },
  iceye: {
    thumbnail: "/images/satellite-examples/iceye.png",
    alt: "Contoh quicklook radar SAR dari ICEYE",
    description: "Contoh quicklook SAR · ICEYE Open Data · CC BY 4.0",
  },
  planet: {
    thumbnail: "/images/satellite-examples/planet.png",
    alt: "Contoh citra PlanetScope dari Nepal",
    description: "PlanetScope · Nepal, 28 Sep 2026 · © Planet · CC BY-NC 4.0",
  },
  vantor: {
    thumbnail: "/images/satellite-examples/vantor.jpg",
    alt: "Contoh citra Vantor dari Nepal",
    description: "Vantor Open Data · Nepal, 2026 · CC BY-NC 4.0",
  },
  airbusOneAtlas: {
    thumbnail: "/images/satellite-examples/airbus-oneatlas.jpg",
    alt: "Citra Pléiades Neo di terminal industri Ingleside, Texas",
    description: "Ingleside, Texas · 3 Nov 2021 · Pléiades Neo · Airbus DS",
  },
  blackskySpectra: {
    thumbnail: "/images/satellite-examples/blacksky-spectra.jpg",
    alt: "Scene BlackSky di pelabuhan Port Elizabeth dengan anotasi aktivitas",
    description: "Port Elizabeth · 10 Agu 2020 · BlackSky Spectra",
  },
  alosAvnir2: {
    thumbnail: "/images/satellite-examples/alos-avnir2.jpg",
    alt: "Citra optik ALOS AVNIR-2 di sekitar Gunung Fuji",
    description: "Gunung Fuji · 28 Nov 2010 · JAXA ALOS/AVNIR-2",
  },
  alosPalsar: {
    thumbnail: "/images/satellite-examples/alos-palsar.jpg",
    alt: "Citra radar ALOS PALSAR di Indonesia",
    description: "Indonesia · scene PALSAR 2009 · JAXA/METI",
  },
  alos2Palsar2: {
    thumbnail: "/images/satellite-examples/alos2-palsar2.jpg",
    alt: "Citra radar ALOS-2 PALSAR-2 di Kyushu, Jepang",
    description: "Kyushu · 28 Agu 2019 · JAXA ALOS-2/PALSAR-2",
  },
  viirs: {
    thumbnail: "/images/satellite-examples/viirs-nightlights.jpg",
    alt: "Komposit lampu malam VIIRS di Indonesia",
    description: "Lampu malam · komposit 2012 · NASA/NOAA VIIRS",
  },
  openAerialMap: {
    thumbnail: "/images/satellite-examples/openaerialmap-freetown.jpg",
    alt: "Scene UAV OpenAerialMap dari Freetown, Sierra Leone",
    description: "Freetown · 16 Apr 2025 · HOT · CC BY-SA 4.0",
  },
} as const;

// Keep generic STAC and credentialed commercial feeds without a fixed sample;
// their thumbnails depend on a user catalog or a licensed provider scene.
function getSatellitePreview(key: string, group: string) {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalizedKey.includes("sentinel2") || group === "Sentinel-2") {
    return SATELLITE_PREVIEW_ASSETS.sentinel2;
  }
  if (normalizedKey.includes("esriwayback") || group === "Basemap Historis") {
    return SATELLITE_PREVIEW_ASSETS.esriWayback;
  }
  if (normalizedKey.includes("bigctsrt") || group === "BIG / CTSRT") {
    return SATELLITE_PREVIEW_ASSETS.bigCtsrt;
  }
  if (normalizedKey.includes("himawari") || group === "Cuaca Geostasioner") {
    return SATELLITE_PREVIEW_ASSETS.himawari;
  }
  if (normalizedKey.includes("sentinel1")) return SATELLITE_PREVIEW_ASSETS.sentinel1;
  if (normalizedKey.includes("sentinel3")) return SATELLITE_PREVIEW_ASSETS.sentinel3;
  if (normalizedKey.includes("sentinel5pno2")) return SATELLITE_PREVIEW_ASSETS.sentinel5pNo2;
  if (normalizedKey.includes("sentinel5pco")) return SATELLITE_PREVIEW_ASSETS.sentinel5pCo;
  if (normalizedKey.includes("sentinel5pch4")) return SATELLITE_PREVIEW_ASSETS.sentinel5pCh4;
  if (normalizedKey.includes("sentinel5po3")) return SATELLITE_PREVIEW_ASSETS.sentinel5pO3;
  if (normalizedKey.includes("sentinel5paerosol")) return SATELLITE_PREVIEW_ASSETS.sentinel5pAerosol;
  if (normalizedKey.includes("sentinel5p")) return SATELLITE_PREVIEW_ASSETS.sentinel5pNo2;
  if (normalizedKey.includes("aster")) return SATELLITE_PREVIEW_ASSETS.aster;
  if (normalizedKey.includes("landsat4")) return SATELLITE_PREVIEW_ASSETS.landsat4;
  if (normalizedKey.includes("landsat5")) return SATELLITE_PREVIEW_ASSETS.landsat5;
  if (normalizedKey.includes("landsat7")) return SATELLITE_PREVIEW_ASSETS.landsat7;
  if (normalizedKey.includes("landsat8")) return SATELLITE_PREVIEW_ASSETS.landsat8;
  if (normalizedKey.includes("landsat9")) return SATELLITE_PREVIEW_ASSETS.landsat9;
  if (normalizedKey.includes("alos2palsar2")) return SATELLITE_PREVIEW_ASSETS.alos2Palsar2;
  if (normalizedKey.includes("alospalsar")) return SATELLITE_PREVIEW_ASSETS.alosPalsar;
  if (normalizedKey.includes("alosavnir2")) return SATELLITE_PREVIEW_ASSETS.alosAvnir2;
  if (normalizedKey.includes("viirs")) return SATELLITE_PREVIEW_ASSETS.viirs;
  if (normalizedKey.includes("openaerialmap")) return SATELLITE_PREVIEW_ASSETS.openAerialMap;
  if (normalizedKey.includes("airbus") || normalizedKey.includes("oneatlas")) {
    return SATELLITE_PREVIEW_ASSETS.airbusOneAtlas;
  }
  if (normalizedKey.includes("blacksky")) return SATELLITE_PREVIEW_ASSETS.blackskySpectra;
  if (normalizedKey.includes("iceye")) return SATELLITE_PREVIEW_ASSETS.iceye;
  if (normalizedKey.includes("planet")) return SATELLITE_PREVIEW_ASSETS.planet;
  if (normalizedKey.includes("vantor") || normalizedKey.includes("maxar")) {
    return SATELLITE_PREVIEW_ASSETS.vantor;
  }
  return undefined;
}

const AOI_STYLE = { color: "#0d6efd", weight: 2, fillOpacity: 0.05 };
const SCENE_TILE_MAX_NATIVE_ZOOM = 19;
const SCENE_TILE_MAX_ZOOM = 23;
const ESRI_WAYBACK_PROVIDER_KEY = "esri_wayback";
const HIMAWARI_PROVIDER_KEY = "himawari";
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
  capabilities: {
    searchable: true,
    downloadable: false,
    analytical: false,
    visualization_only: true,
    supports_time: true,
    supports_cloud_filter: false,
    supports_bands: false,
    supports_raw_data: false,
    supports_ai: false,
    requires_authentication: false,
    commercial: false,
    open_data: false,
  },
  description:
    "Arsip rilis World Imagery basemap. Tanggal adalah tanggal publikasi Wayback, bukan selalu tanggal akuisisi sensor.",
};
const HIMAWARI_PROVIDER: ImageryProvider = {
  key: HIMAWARI_PROVIDER_KEY,
  name: "Himawari-9 - Cuaca Asia-Pasifik",
  provider: "Japan Meteorological Agency (JMA)",
  group: "Cuaca Geostasioner",
  gee_collection: "",
  source_kind: "himawari",
  visualization: "rgb",
  color_mode: "natural",
  resolution_m: 2000,
  revisit_days: 0.007,
  start_year: 2015,
  cloud_property: null,
  cloud_mask_techniques: null,
  capabilities: {
    searchable: true,
    downloadable: false,
    analytical: false,
    visualization_only: true,
    supports_time: true,
    supports_cloud_filter: false,
    supports_bands: false,
    supports_raw_data: false,
    supports_ai: false,
    requires_authentication: false,
    commercial: false,
    open_data: true,
  },
  description: "Citra cuaca full-disk Asia-Pasifik dari JMA. Pilih waktu UTC; resolusi kilometer untuk pengamatan awan dan sistem cuaca.",
};
const LEGACY_LANDSAT_DEFAULT_RANGES: Record<string, [string, string]> = {
  landsat4: ["1993-05-25", "1993-06-24"],
  landsat5: ["2012-04-05", "2012-05-05"],
  landsat7: ["2023-12-20", "2024-01-19"],
  alos_avnir2: ["2006-04-26", "2011-04-18"],
  alos_palsar_yearly: ["2015-01-01", "2024-01-01"],
};
type ViewMode = "single" | "compare";
type DemLayerMode = "none" | "dem" | "3d";

type SceneFootprintProperties = {
  sceneId: string;
  selected: boolean;
  hovered: boolean;
};

type ScientificCapabilityKey = "hyperspectral" | "thermal" | "insar" | "ai";
type ScientificSupport = Record<ScientificCapabilityKey, boolean>;

function ProviderFeatureAccordion({
  title,
  icon,
  variant = "secondary",
  children,
}: {
  title: string;
  icon: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  return (
    <details className={`card border-${variant} mb-3 imagery-provider-accordion`}>
      <summary className="card-header py-2 d-flex align-items-center gap-2">
        <i className={icon} aria-hidden="true" />
        <strong><small>{title}</small></strong>
        <i className="bi bi-chevron-down imagery-provider-accordion-chevron" aria-hidden="true" />
      </summary>
      <div className="card-body py-2">{children}</div>
    </details>
  );
}

function ScientificCapabilitiesPanel({ support, providerKey }: { support: ScientificSupport; providerKey: string }) {
  const t = useI18nStore((state) => state.t);
  const hasSupport = Object.values(support).some(Boolean);
  const [capabilities, setCapabilities] = useState<AdvancedImageryCapabilities | null>(null);
  useEffect(() => {
    if (!hasSupport) return;
    let active = true;
    void getImageryAdvancedCapabilities().then((value) => { if (active) setCapabilities(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [hasSupport]);
  if (!hasSupport || !capabilities) return null;
  const items = [
    ["hyperspectral", t("imagery.scientific.hyperspectral"), capabilities.hyperspectral.status],
    ["thermal", t("imagery.scientific.thermal"), capabilities.thermal.status],
    ["insar", t("imagery.scientific.insar"), capabilities.insar.status],
    ["ai", t("imagery.scientific.ai"), capabilities.ai.status],
  ].filter(([key]) => support[key as ScientificCapabilityKey]).map(([, label, status]) => [label, status] as const);
  if (!items.length) return null;
  return <ProviderFeatureAccordion key={providerKey} title={t("imagery.scientific.title")} icon="bi bi-cpu">
    <div className="small">
      {items.map(([label, status]) => <div key={label} className="d-flex justify-content-between align-items-center border-bottom py-1"><span>{label}</span><span className={`badge ${status === "ready" ? "text-bg-success" : "text-bg-secondary"}`}>{status}</span></div>)}
      <div className="text-muted mt-2">{t("imagery.scientific.hint")}</div>
    </div>
  </ProviderFeatureAccordion>;
}

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

function ImageryMapViewportReporter({
  onChange,
}: {
  onChange: (region: AoiFeature | null) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const updateRegion = () => {
      const size = map.getSize();
      if (size.x < 64 || size.y < 64) return;
      const bounds = map.getBounds();
      if (!bounds.isValid()) return;
      const west = Math.max(-180, bounds.getWest());
      const east = Math.min(180, bounds.getEast());
      const south = Math.max(-85, bounds.getSouth());
      const north = Math.min(85, bounds.getNorth());
      if (west >= east || south >= north) return;
      onChange({
        type: "Feature",
        properties: { source: "map-viewport", name: "Map view" },
        geometry: {
          type: "Polygon",
          coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
        },
      });
    };
    updateRegion();
    map.on("moveend", updateRegion);
    map.on("resize", updateRegion);
    return () => {
      map.off("moveend", updateRegion);
      map.off("resize", updateRegion);
    };
  }, [map, onChange]);
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

function formatSceneDate(iso: string, isEsriWayback: boolean): string {
  if (!isEsriWayback) return formatAcquired(iso);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return `Rilis Wayback · ${iso}`;
  return `Rilis Wayback · ${d.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  })}`;
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


function sceneResolution(scene: ImageryScene | undefined, assetKey: string, fallback?: number | null) {
  return scene?.assets?.find(asset => asset.key === assetKey)?.resolution_m ?? scene?.resolution_m ?? fallback;
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
 * date+time and view it with the provider's configured visualization. Large
 * AOIs can be filled automatically with a date-range mosaic while the
 * selected scene remains the provenance anchor.
 * Answers the user's direct request: "bagaimana bisa melihat citra satelit
 * utk tanggal beserta jam tertentu, tanpa harus land cover?" - every other
 * module (Vegetation/Carbon/LC-Change) always composites over a date range
 * and only ever exposes month- or (Dynamic World only) day-level granularity;
 * Scene tiles retain the original spatial resolution. Cloud masking is
 * enabled by default and can be disabled to inspect the original clouds.
 */
export default function ImageryModule() {
  const t = useI18nStore((state) => state.t);
  const query = parseQuery(typeof window !== "undefined" ? window.location.search : "");
  const aoiState = useAoiStore((s) => s.aoi);
  const setAoiState = useAoiStore((s) => s.setAoi);
  const aoi: AoiFeature | null = aoiState?.feature ?? null;
  const [mapViewportAoi, setMapViewportAoi] = useState<AoiFeature | null>(null);
  const [sceneSearchRegion, setSceneSearchRegion] = useState<AoiFeature | null>(null);
  const [aoiModalOpen, setAoiModalOpen] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);

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
  const [satellite, setSatellite] = useState(query.satellite ?? query.provider ?? "sentinel2");
  useEffect(() => {
    let cancelled = false;
    getImageryProviders()
      .then((res) => {
        if (cancelled) return;
        setSatellites(res.providers);
        setSatellite((current) =>
          current === ESRI_WAYBACK_PROVIDER_KEY || current === HIMAWARI_PROVIDER_KEY || res.providers[current]
            ? current
            : res.default,
        );
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

  const [startDate, setStartDate] = useState(query.startDate ?? daysAgoIso(30));
  const [endDate, setEndDate] = useState(query.endDate ?? todayIso());
  const [cloudFilterEnabled, setCloudFilterEnabled] = useState(true);
  const [maxCloudCover, setMaxCloudCover] = useState(query.cloudThreshold ?? 60);
  const [superResolution, setSuperResolution] = useState<ImagerySuperResolutionMode>("off");
  const [visualEnhancement, setVisualEnhancement] = useState(Boolean(query.enhance));
  const [gpuOpacity, setGpuOpacity] = useState(query.showOriginal ? 0 : 1);
  const gpuEnhancement = useGpuSuperResolution(visualEnhancement);
  const [stacCatalogUrl, setStacCatalogUrl] = useState("");
  const [stacCollections, setStacCollections] = useState("");
  const [planetProduct, setPlanetProduct] = useState("all");
  const [airbusConstellation, setAirbusConstellation] = useState("");
  const [cogAssetKey, setCogAssetKey] = useState("visual");
  const [cogBands, setCogBands] = useState("");
  const [cogRescale, setCogRescale] = useState("");

  const [scenes, setScenes] = useState<ImageryScene[]>([]);
  const [sceneSearch, setSceneSearch] = useState("");
  const [scenePage, setScenePage] = useState(1);
  const [scenePageSize, setScenePageSize] = useState(25);
  const [sceneTilesById, setSceneTilesById] = useState<Record<string, string>>({});
  const [truncated, setTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [sceneResultsOpen, setSceneResultsOpen] = useState(true);

  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [hoverSceneId, setHoverSceneId] = useState<string | null>(null);
  const [focusSceneId, setFocusSceneId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [tileRenderMode, setTileRenderMode] = useState<"scene" | "mosaic">("scene");
  const [tileSceneCount, setTileSceneCount] = useState(1);
  const [mosaicRequested, setMosaicRequested] = useState(false);
  const [tileOpacity, setTileOpacity] = useState(query.opacity ?? 1);
  const [gpuTileStatus, setGpuTileStatus] = useState<"processing" | "active" | "fallback_original" | "error">("processing");

  const globeQuery = useGlobeQuery();
  const mapMode: "flat" | "globe" = ["3d", "globe"].includes(globeQuery.get("view") ?? "") ? "globe" : "flat";
  const setMapMode = (mode: "flat" | "globe") => writeGlobeQuery({ view: mode === "globe" ? "3d" : "single" }, true);
  const [globeBasemapId, setGlobeBasemapId] = useState(query.basemap ?? "satellite");
  const [globeCamera] = useState({
    lat: query.globeLat ?? -2.5,
    lng: query.globeLng ?? 118,
    zoom: query.globeZoom ?? 3.5,
    bearing: query.globeHeading ?? 0,
    pitch: query.globePitch ?? 0,
  });
  useEffect(() => {
    if (typeof window === "undefined" || !["/satellite-imagery", "/imagery"].includes(window.location.pathname)) return;
    updateUrlFromState({
      ...query,
      satellite,
      startDate,
      endDate,
      cloudThreshold: maxCloudCover,
      opacity: tileOpacity,
      view: mapMode === "globe" ? "3d" : ["3d", "globe"].includes(query.view ?? "") ? "single" : query.view,
      basemap: globeBasemapId,
      enhance: visualEnhancement,
      enhanceModel: gpuEnhancement.model,
      enhanceScale: gpuEnhancement.model === "shader_x4" ? 4 : 2,
      enhanceBackend: gpuEnhancement.backend,
      showOriginal: !visualEnhancement || gpuOpacity < 0.5,
    });
  }, [globeBasemapId, globeCamera, mapMode, maxCloudCover, endDate, query, satellite, startDate, tileOpacity, visualEnhancement, gpuOpacity, gpuEnhancement.backend, gpuEnhancement.model]);
  const [tileLoading, setTileLoading] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);
  const [segmentation, setSegmentation] = useState<FeatureCollection | null>(null);
  const [nasaTimeLayerUrl, setNasaTimeLayerUrl] = useState<string | null>(null);
  const [himawariTimeLayerUrl, setHimawariTimeLayerUrl] = useState<string | null>(null);
  const [himawariOpacity, setHimawariOpacity] = useState(0.65);
  const [storyMap, setStoryMap] = useState<FeatureCollection | null>(null);
  const [provenanceOpen, setProvenanceOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(true);
  useEffect(() => { setSegmentation(null); }, [selectedSceneId, satellite, aoi, cogAssetKey, cogBands, cogRescale]);
  const searchRequestRef = useRef(0);
  const tileRequestRef = useRef(0);
  const renderOptionsKeyRef = useRef("");
  const mosaicRequestedRef = useRef(false);
  const sceneRequestedRef = useRef(false);
  const setMosaicRequestedMode = (value: boolean) => {
    mosaicRequestedRef.current = value;
    setMosaicRequested(value);
  };
  const setSceneRequestedMode = (value: boolean) => {
    sceneRequestedRef.current = value;
  };
  const mosaicQueryRef = useRef({ startDate, endDate, maxCloudCover });
  useEffect(() => {
    mosaicQueryRef.current = { startDate, endDate, maxCloudCover };
  }, [endDate, maxCloudCover, startDate]);

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
  const compareRequestRef = useRef(0);
  const invalidateCompare = useCallback(() => { ++compareRequestRef.current; }, []);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  const [demResult, setDemResult] = useState<DemTileResponse | null>(null);
  const [demLoading, setDemLoading] = useState(false);
  const [demError, setDemError] = useState<string | null>(null);
  const [demLayerMode, setDemLayerMode] = useState<DemLayerMode>("none");

  const imageryProviders = useMemo<Record<string, ImageryProvider>>(
    () => ({
      ...satellites,
      [ESRI_WAYBACK_PROVIDER_KEY]: ESRI_WAYBACK_PROVIDER,
      [HIMAWARI_PROVIDER_KEY]: {
        ...HIMAWARI_PROVIDER,
        ...satellites[HIMAWARI_PROVIDER_KEY],
        capabilities: {
          ...HIMAWARI_PROVIDER.capabilities,
          ...satellites[HIMAWARI_PROVIDER_KEY]?.capabilities,
          searchable: true,
          supports_time: true,
          visualization_only: true,
        } as ImageryProvider["capabilities"],
      },
    }),
    [satellites],
  );
  const satelliteMeta = imageryProviders[satellite];
  const configuredPlanetCollections = satelliteMeta?.key === "planet_commercial"
    ? satelliteMeta.configured_stac_collections ?? []
    : [];
  const planetProductOptions = [
    { value: "planetscope", label: "PlanetScope · PSScene", collections: ["PSScene"] },
    { value: "skysat", label: "SkySat · SkySatScene / SkySatCollect", collections: ["SkySatScene", "SkySatCollect"] },
  ].map((option) => ({
    ...option,
    collections: option.collections.filter((collection) => configuredPlanetCollections.includes(collection)),
  })).filter((option) => option.collections.length > 0);
  const selectedPlanetCollections = planetProductOptions.find((option) => option.value === planetProduct)?.collections.join(",");
  const isEsriWayback = satellite === ESRI_WAYBACK_PROVIDER_KEY;
  const isHimawari = satellite === HIMAWARI_PROVIDER_KEY;
  const providerUi = getImageryUiCapabilities(satelliteMeta);
  const isMosaicProvider = providerUi.mosaic;
  const isCogProvider = providerUi.cog;
  const supportsSceneMetadata = providerUi.sceneMetadata;
  const supportsCompare = providerUi.compare;
  const supportsPreview = providerUi.preview;
  const supportsSearch = providerUi.search;
  const supportsDownload = providerUi.download;
  const supportsAnalyticalTools = providerUi.analysis;
  const supportsBandControls = providerUi.bands;
  const supportsSuperResolution = providerUi.superResolution && !isEsriWayback;
  const supportsCloudFilter = providerUi.cloudFilter;
  // Browser GPU enhancement is meaningful for RGB scene tiles. SAR and
  // single-band concentration products use different visual semantics, while
  // Wayback is already a basemap archive rather than an analytic scene.
  const supportsGpuEnhancement = providerUi.visualEnhancement && !isEsriWayback;
  const effectiveVisualEnhancement = visualEnhancement && supportsGpuEnhancement;
  const supportsSamGeo = Boolean(isCogProvider && satelliteMeta?.capabilities?.supports_ai);
  const scientificSupport: ScientificSupport = {
    hyperspectral: ["sentinel3", "aster", "stac_catalog"].includes(satellite),
    thermal: ["landsat4", "landsat5", "landsat7", "landsat8", "landsat9", "aster"].includes(satellite),
    insar: satelliteMeta?.visualization === "sar",
    ai: supportsSamGeo,
  };
  const activeSuperResolution = supportsSuperResolution ? superResolution : "off";
  // Keep the source tile native whenever the browser enhancer is active; the
  // two visual passes must never be stacked or fed into analytics.
  const tileSuperResolution = effectiveVisualEnhancement ? "off" : activeSuperResolution;
  const renderOptionsKey = `${activeSuperResolution}:${sarMode}:${cloudFilterEnabled ? cloudMaskTechnique : "raw"}:${cogAssetKey}:${cogBands}:${cogRescale}`;
  const sceneTileMaxNativeZoom =
    isEsriWayback
      ? SCENE_TILE_MAX_NATIVE_ZOOM
      : nativeZoomForResolution(sceneResolution(scenes.find(s => s.id === selectedSceneId), cogAssetKey, satelliteMeta?.resolution_m));
  const sceneFocusMaxZoom = supportsSceneMetadata ? 21 : Math.min(sceneTileMaxNativeZoom, 17);
  useEffect(() => {
    invalidateCompare();
    setCompareTileA(null);
    setCompareTileB(null);
    setCompareLoading(false);
    setCompareError(null);
    return invalidateCompare;
  }, [aoi, satellite, renderOptionsKey, compareSceneAId, compareSceneBId, invalidateCompare]);
  useEffect(() => {
    ++tileRequestRef.current;
    setPlanetProduct("all");
    setAirbusConstellation("");
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
    setTileRenderMode("scene");
    setTileSceneCount(1);
    setMosaicRequestedMode(false);
    setSceneRequestedMode(false);
    setTileError(null);
    setTileLoading(false);
    setCompareSceneAId(null);
    setCompareSceneBId(null);
    setCompareTileA(null);
    setCompareTileB(null);
    setCompareError(null);
    setSceneSearchRegion(null);
    setCogAssetKey("visual");
    setCogBands("");
    setCogRescale("");
    setViewMode("single");
    if (satellite !== HIMAWARI_PROVIDER_KEY) setHimawariTimeLayerUrl(null);
    if (satellite === ESRI_WAYBACK_PROVIDER_KEY) {
      // Wayback contains monthly archive releases, so the generic "last 30
      // days" scene default often has no results. Start at archive coverage
      // when the provider is selected; users can still narrow the range.
      setStartDate(ESRI_WAYBACK_START_DATE);
      setEndDate(todayIso());
    }
    const legacyRange = LEGACY_LANDSAT_DEFAULT_RANGES[satellite];
    if (satellite === "alos2_palsar2_scansar") {
      setStartDate("2014-08-04");
      setEndDate(todayIso());
    } else if (legacyRange) {
      setStartDate(legacyRange[0]);
      setEndDate(legacyRange[1]);
    }
  }, [satellite]);

  // Changing the shared AOI invalidates catalog results and pending previews;
  // preserve the user's provider and date filters for the next search.
  useEffect(() => {
    ++searchRequestRef.current;
    ++tileRequestRef.current;
    setSearching(false);
    setScenes([]);
    setSceneTilesById({});
    setTruncated(false);
    setSearched(false);
    setSearchError(null);
    setTileError(null);
    setTileLoading(false);
    setSelectedSceneId(null);
    setHoverSceneId(null);
    setFocusSceneId(null);
    setTileUrl(null);
    setHimawariTimeLayerUrl(null);
    setSceneSearchRegion(null);
  }, [aoi]);

  // Fixed group order (SearchableSelect renders a group header whenever an
  // option's group differs from the previous option's - it does NOT sort by
  // group itself, so the array must already come in group order).
  const GROUP_ORDER = [
    "Commercial SAR",
    "Commercial EO",
    "Basemap Historis",
    "Cuaca Geostasioner",
    "BIG / CTSRT",
    "Open Aerial",
    "Open Disaster",
    "Custom STAC",
    "Sentinel-2",
    "USGS / Landsat",
    "Sentinel-3",
    "ASTER",
    "ALOS / JAXA",
    "Sentinel-1",
    "Sentinel-5P",
    "VIIRS",
  ];
  const satelliteOptions = useMemo(() => {
    return Object.values(imageryProviders)
      .sort((a, b) => {
        const gi = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
        return gi !== 0 ? gi : (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name);
      })
      // Resolution shown right in the option label (user request) - lets you
      // compare sensors at a glance without selecting each one first.
      .map((s) => {
        const preview = getSatellitePreview(s.key, s.group);
        return {
          value: s.key,
          label: s.key === ESRI_WAYBACK_PROVIDER_KEY
            ? `${s.name} · sub-meter/variasi`
            : `${s.name} · ${s.resolution_m == null ? "resolusi mengikuti produk" : formatResolution(s.resolution_m)}`,
          group: s.group,
          ...(preview && {
            thumbnail: preview.thumbnail,
            thumbnailAlt: preview.alt,
            thumbnailTitle: preview.description,
            description: preview.description,
          }),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageryProviders]);

  const loadSceneTile = useCallback(
    async (
      scene: ImageryScene,
      assetKeyOverride?: string,
      forceMosaicOverride?: boolean,
      aoiOverride?: AoiFeature | null,
    ) => {
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
      setTileRenderMode("scene");
      setTileSceneCount(1);
      try {
        if (isHimawari) {
          const frameTileUrl = himawariTileUrlFromSceneId(scene.id);
          if (!frameTileUrl) throw new Error("ID frame Himawari tidak valid.");
          if (requestId !== tileRequestRef.current) return;
          setHimawariTimeLayerUrl(frameTileUrl);
          return;
        }
        if (isEsriWayback) {
          const waybackTile = sceneTilesById[scene.id] ?? (scene as WaybackScene).tile_url;
          if (!waybackTile) throw new Error("Tile Esri Wayback untuk rilis ini tidak ditemukan.");
          if (requestId !== tileRequestRef.current) return;
          setTileUrl(waybackTile);
          return;
        }
        const mosaicQuery = mosaicQueryRef.current;
        const tileAoi = aoi ?? aoiOverride ?? null;
        const mosaicEndDate = new Date(`${mosaicQuery.endDate}T00:00:00Z`);
        mosaicEndDate.setUTCDate(mosaicEndDate.getUTCDate() + 1);
        const res = await getImagerySceneTile({
          satellite,
          sceneId: scene.id,
          aoi: tileAoi ? { geojson: tileAoi } : undefined,
          autoMosaic: isMosaicProvider && Boolean(tileAoi),
          forceMosaic: isMosaicProvider && Boolean(tileAoi) && (forceMosaicOverride ?? mosaicRequestedRef.current),
          forceScene: isMosaicProvider && Boolean(tileAoi) && sceneRequestedRef.current && !mosaicRequestedRef.current,
          startDate: isMosaicProvider && tileAoi ? mosaicQuery.startDate : undefined,
          endDate: isMosaicProvider && tileAoi ? mosaicEndDate.toISOString().slice(0, 10) : undefined,
          maxCloudCover: isMosaicProvider && tileAoi && supportsCloudFilter && cloudFilterEnabled ? mosaicQuery.maxCloudCover : undefined,
          sarMode,
          cloudMaskTechnique: cloudFilterEnabled ? cloudMaskTechnique : undefined,
          superResolution: tileSuperResolution,
          cogAssetKey: isCogProvider ? effectiveCogAssetKey : undefined,
          cogBands: isCogProvider ? cogBands.trim() || undefined : undefined,
          cogRescale: isCogProvider ? cogRescale.trim() || undefined : undefined,
        });
        if (requestId !== tileRequestRef.current) return;
        setTileUrl(res.tile_url);
        setTileRenderMode(res.render_mode ?? "scene");
        setTileSceneCount(res.scene_count ?? 1);
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
      tileSuperResolution,
      aoi,
      cloudFilterEnabled,
      cloudMaskTechnique,
      cogAssetKey,
      cogBands,
      cogRescale,
      isHimawari,
      isCogProvider,
      isEsriWayback,
      isMosaicProvider,
      renderOptionsKey,
      sarMode,
      satellite,
      sceneTilesById,
      supportsCloudFilter,
    ],
  );

  const searchScenes = async () => {
    if (!supportsSearch) {
      setSearchError(satelliteMeta?.configuration_message ?? "Provider ini belum memiliki adapter pencarian yang tersedia.");
      return;
    }
    const searchRegion = aoi ?? mapViewportAoi;
    if (!searchRegion && !isHimawari && !isEsriWayback) {
      setSearchError("Peta belum siap. Tunggu peta selesai dimuat lalu coba lagi.");
      return;
    }
    if (!startDate || !endDate || (isHimawari ? startDate > endDate : startDate >= endDate)) {
      setSearchError(`${t("imagery.dateRange")} tidak valid (${isHimawari ? "tanggal awal tidak boleh setelah tanggal akhir" : "tanggal awal harus sebelum tanggal akhir"}).`);
      return;
    }
    const requestId = ++searchRequestRef.current;
    ++tileRequestRef.current;
    setSearching(true);
    setSceneResultsOpen(true);
    setSearchError(null);
    setSceneSearchRegion(searchRegion);
      setSelectedSceneId(null);
      setHoverSceneId(null);
      setFocusSceneId(null);
      setFocusNonce((value) => value + 1);
      setTileUrl(null);
      setTileRenderMode("scene");
      setTileSceneCount(1);
      setMosaicRequestedMode(false);
      setSceneRequestedMode(false);
      setTileError(null);
      setTileLoading(false);
      setSceneTilesById({});
      setCompareSceneAId(null);
      setCompareSceneBId(null);
      setCompareTileA(null);
      setCompareTileB(null);
      setCompareError(null);
      setHimawariTimeLayerUrl(null);
    try {
      const res = isHimawari
        ? { scenes: await listHimawariScenes(startDate, endDate), truncated: false }
        : isEsriWayback
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
              aoi: { geojson: searchRegion! },
              satellite,
              startDate,
              endDate: supportsSceneMetadata ? endDate : inclusiveEnd.toISOString().slice(0, 10),
              maxCloudCover: supportsCloudFilter && cloudFilterEnabled ? maxCloudCover : undefined,
              stacCatalogUrl: satelliteMeta?.source_kind === "generic_stac" ? stacCatalogUrl.trim() : undefined,
              stacCollections: satelliteMeta?.source_kind === "generic_stac"
                ? stacCollections.trim() || undefined
                : satelliteMeta?.key === "planet_commercial" && planetProduct !== "all"
                  ? selectedPlanetCollections
                  : undefined,
              constellation: satelliteMeta?.key === "airbus_oneatlas" ? airbusConstellation || undefined : undefined,
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
      if (scenesByNewest[0] && supportsPreview) {
        const defaultAssetKey = scenesByNewest[0].default_asset_key || "visual";
        setCogAssetKey(defaultAssetKey);
        // Prefer the AOI mosaic for supported providers whenever the search
        // returned multiple matching granules. A single returned granule
        // still goes through the backend's AOI-footprint check via autoMosaic.
        const initialMosaicAvailable = isMosaicProvider && Boolean(searchRegion) && scenesByNewest.length > 1;
        if (initialMosaicAvailable) {
          setMosaicRequestedMode(true);
          setSceneRequestedMode(false);
        }
        await loadSceneTile(
          scenesByNewest[0],
          defaultAssetKey,
          initialMosaicAvailable ? true : undefined,
          initialMosaicAvailable ? searchRegion : undefined,
        );
      } else if (scenesByNewest[0]) {
        setSelectedSceneId(scenesByNewest[0].id);
        setTileError(satelliteMeta?.configuration_message ?? "Provider ini belum menyediakan preview scene.");
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
    setMosaicRequestedMode(false);
    setSceneRequestedMode(true);
    if (!supportsPreview) {
      setSelectedSceneId(scene.id);
      setTileUrl(null);
      setTileError(satelliteMeta?.configuration_message ?? "Provider ini belum menyediakan preview scene.");
      return;
    }
    void loadSceneTile(scene, nextAssetKey);
  };

  const loadMosaicTile = () => {
    const mosaicRegion = aoi ?? sceneSearchRegion ?? mapViewportAoi;
    if (!isMosaicProvider || !mosaicRegion || scenes.length === 0) return;
    const anchorScene = [...scenes].sort((a, b) => (a.acquired_at < b.acquired_at ? 1 : -1))[0];
    if (!anchorScene) return;
    setMosaicRequestedMode(true);
    setSceneRequestedMode(false);
    setViewMode("single");
    void loadSceneTile(anchorScene, anchorScene.default_asset_key || "visual", true, mosaicRegion);
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
    const requestId = ++compareRequestRef.current;
    setCompareLoading(true);
    setCompareError(null);
    setCompareTileA(null);
    setCompareTileB(null);
    try {
      if (isEsriWayback || isHimawari) {
        const tileA = sceneTilesById[compareSceneAId];
        const tileB = sceneTilesById[compareSceneBId];
        const frameTileA = isHimawari ? himawariTileUrlFromSceneId(compareSceneAId) : tileA;
        const frameTileB = isHimawari ? himawariTileUrlFromSceneId(compareSceneBId) : tileB;
        if (!frameTileA || !frameTileB) {
          throw new Error(isHimawari ? "Tile JMA untuk salah satu frame tidak ditemukan." : "Tile Esri Wayback untuk salah satu rilis tidak ditemukan.");
        }
        setCompareTileA(frameTileA);
        setCompareTileB(frameTileB);
        return;
      }
      const [resA, resB] = await Promise.all([
        getImagerySceneTile({
          satellite,
          sceneId: compareSceneAId,
          aoi: aoi ? { geojson: aoi } : undefined,
          sarMode,
          cloudMaskTechnique: cloudFilterEnabled ? cloudMaskTechnique : undefined,
          superResolution: tileSuperResolution,
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
          superResolution: tileSuperResolution,
          cogAssetKey: isCogProvider ? cogAssetKey || undefined : undefined,
          cogBands: isCogProvider ? cogBands.trim() || undefined : undefined,
          cogRescale: isCogProvider ? cogRescale.trim() || undefined : undefined,
        }),
      ]);
      if (requestId !== compareRequestRef.current) return;
      setCompareTileA(resA.tile_url);
      setCompareTileB(resB.tile_url);
    } catch (err) {
      if (requestId === compareRequestRef.current) setCompareError(err instanceof Error ? err.message : "Gagal memuat salah satu citra scene.");
    } finally {
      if (requestId === compareRequestRef.current) setCompareLoading(false);
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
  const filteredScenes = useMemo(() => {
    const needle = sceneSearch.trim().toLowerCase();
    if (!needle) return sortedScenes;
    return sortedScenes.filter((scene) => [scene.id, scene.title, scene.collection, scene.acquired_at, scene.platform, scene.producer, scene.default_asset_key].some((value) => String(value ?? "").toLowerCase().includes(needle)));
  }, [sceneSearch, sortedScenes]);
  const scenePageCount = Math.max(1, Math.ceil(filteredScenes.length / scenePageSize));
  const visibleScenes = useMemo(() => filteredScenes.slice((scenePage - 1) * scenePageSize, scenePage * scenePageSize), [filteredScenes, scenePage, scenePageSize]);
  useEffect(() => registerUiCommands("scenes", {
    read: () => ({
      provider: satellite,
      availableProviders: Object.keys(imageryProviders),
      providers: Object.values(imageryProviders).map(p => ({ key: p.key, name: p.name, capabilities: p.capabilities, configuration_status: p.configuration_status })),
      scenes: scenes.slice(0, 20).map(s => ({ id: s.id, acquired_at: s.acquired_at, platform: s.platform, resolution_m: s.resolution_m, cloud_cover_pct: s.cloud_cover_pct })) ,
      startDate,
      endDate,
      cloudMax: cloudFilterEnabled ? maxCloudCover : null,
      page: scenePage,
      pageSize: scenePageSize,
      pageCount: scenePageCount,
      search: sceneSearch,
      resultsOpen: sceneResultsOpen,
      sceneCount: scenes.length,
      truncated,
      selectedSceneId,
      selectedScene: scenes.find(s => s.id === selectedSceneId) ? ((s) => ({ id: s.id, acquired_at: s.acquired_at, platform: s.platform, resolution_m: s.resolution_m, cloud_cover_pct: s.cloud_cover_pct }))(scenes.find(s => s.id === selectedSceneId)!) : null,
      sceneVisible: Boolean(tileUrl || himawariTimeLayerUrl),
      availableSceneIds: scenes.map((scene) => scene.id),
      error: searchError || tileError,
    }),
    execute: async ({ action, target, parameters }) => {
      const value = parameters?.value;
      if (action === "set_provider" && target === "scenes.provider") {
        if (typeof value !== "string" || !imageryProviders[value]) throw new Error("Provider scene tidak tersedia.");
        setSatellite(value);
      } else if (action === "set_date_range" && target === "scenes.dateRange") {
        const start = parameters?.start;
        const end = parameters?.end;
        const validDate = (date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));
        if (!validDate(start) || !validDate(end) || (start as string) > (end as string)) throw new Error("Rentang tanggal scene tidak valid.");
        setStartDate(start as string);
        setEndDate(end as string);
      } else if (action === "set_parameter" && target === "scenes.cloudMax") {
        if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) throw new Error("Ambang awan harus 0 sampai 100 persen.");
        setCloudFilterEnabled(true);
        setMaxCloudCover(value as number);
      } else if (action === "set_parameter" && target === "scenes.search") {
        if (typeof value !== "string" || value.length > 200) throw new Error("Teks pencarian scene tidak valid.");
        setSceneSearch(value);
      } else if (action === "set_parameter" && target === "scenes.pageSize") {
        if (![25, 50, 100].includes(value as number)) throw new Error("Ukuran halaman harus 25, 50, atau 100.");
        setScenePageSize(value as number);
        setScenePage(1);
      } else if (action === "set_parameter" && target === "scenes.page") {
        if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > scenePageCount) throw new Error("Halaman scene di luar hasil yang telah dimuat.");
        setScenePage(value as number);
      } else if (action === "search_scenes" && target === "scenes.searchRequest") {
        if (!aoi && !mapViewportAoi && !isHimawari && !isEsriWayback) {
          throw new Error("Peta belum siap. Tunggu peta selesai dimuat lalu coba lagi.");
        }
        if (searching) throw new Error("Pencarian scene masih berjalan.");
        await searchScenes();
      } else if (action === "show_scene" && target === "scenes.scene") {
        const sceneId = parameters?.scene_id;
        const visible = parameters?.visible;
        if (typeof visible !== "boolean") throw new Error("Visibilitas scene harus true atau false.");
        if (!visible) {
          ++tileRequestRef.current;
          setTileUrl(null);
          setHimawariTimeLayerUrl(null);
          setSelectedSceneId(null);
          return;
        }
        const scene = sceneId === "latest"
          ? [...scenes].filter(s => Number.isFinite(Date.parse(s.acquired_at))).sort((a, b) => Date.parse(b.acquired_at) - Date.parse(a.acquired_at))[0]
          : scenes.find((item) => item.id === sceneId);
        if (!scene) throw new Error("Scene tidak ditemukan untuk AOI dan filter saat ini. Perluas rentang tanggal atau ubah filter awan.");
        setMosaicRequestedMode(false);
        setSceneRequestedMode(true);
        await loadSceneTile(scene, scene.default_asset_key || "visual");
      } else if (action === "clear_scenes" && target === "scenes.layers") {
        ++tileRequestRef.current;
        setTileUrl(null);
        setHimawariTimeLayerUrl(null);
        setSelectedSceneId(null);
      } else if (action === "accordion" && target === "scenes.results") {
        if (typeof parameters?.open !== "boolean") throw new Error("Status panel harus true atau false.");
        setSceneResultsOpen(parameters.open);
      } else {
        throw new Error(`Perintah ${action} untuk ${target} tidak didukung.`);
      }
    },
  }));
  useEffect(() => { setScenePage(1); }, [sceneSearch, scenes]);
  useEffect(() => { setScenePage((page) => Math.min(page, scenePageCount)); }, [scenePageCount]);
  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  );
  const focusScene = useMemo(
    () => scenes.find((s) => s.id === focusSceneId) ?? selectedScene,
    [focusSceneId, scenes, selectedScene],
  );
  const selectedSceneAssets = selectedScene?.assets ?? [];
  const activeCogAsset = selectedSceneAssets.find((asset) => asset.key === (selectedScene?.default_asset_key || cogAssetKey)) ?? selectedSceneAssets[0] ?? null;
  const activeCogDownloadUrl = selectedScene && activeCogAsset && supportsDownload
    ? getImageryAssetUrl(selectedScene.id, activeCogAsset.key, satellite)
    : null;
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

  const globeLayers = useMemo<GlobeLayer[]>(() => {
    const result: GlobeLayer[] = [];
    if (nasaTimeLayerUrl) result.push({ id: "nasa-time", type: "raster", url: nasaTimeLayerUrl, opacity: 0.55, attribution: "NASA GIBS / Earthdata" });
    if (himawariTimeLayerUrl) result.push({ id: "himawari-time", type: "raster", url: himawariTimeLayerUrl, opacity: himawariOpacity, maxZoom: SCENE_TILE_MAX_ZOOM, maxNativeZoom: 5, attribution: "JMA Himawari-9" });
    if (tileUrl) result.push({ id: "scene-result", type: "raster", url: tileUrl, opacity: tileOpacity, maxZoom: SCENE_TILE_MAX_ZOOM, maxNativeZoom: sceneTileMaxNativeZoom, attribution: "Scene imagery" });
    if (demLayerMode !== "none" && demResult?.tile_url) result.push({ id: "dem-result", type: "raster", url: demResult.tile_url, opacity: 0.82, attribution: demResult.source });
    if (segmentation) result.push({ id: "segmentation-result", type: "geojson", data: segmentation, color: "#e83e8c", fillColor: "#e83e8c", opacity: 0.18 });
    return result;
  }, [demLayerMode, demResult, himawariOpacity, himawariTimeLayerUrl, nasaTimeLayerUrl, sceneTileMaxNativeZoom, segmentation, tileOpacity, tileUrl]);

  return (
    <div className="analysis-page analysis-page-imagery">
      <section className="analysis-hero analysis-hero-imagery" aria-labelledby="imageryHeroTitle">
        <div className="analysis-hero-main">
          <span className="analysis-eyebrow">{t("imagery.eyebrow")}</span>
          <h1 id="imageryHeroTitle">{t("imagery.title")}</h1>
          <p>
            {t("imagery.description")}
          </p>
        </div>
        <div className="analysis-hero-status">
          <div className="analysis-status-card">
            <i className="bi bi-bounding-box-circles" />
            <div>
              <span>AOI</span>
              <strong>{aoi ? aoi.geometry.type : t("imagery.notDrawn")}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-globe2" />
            <div>
              <span>{t("imagery.satellite")}</span>
              <strong>{satelliteMeta?.name ?? satellite}</strong>
            </div>
          </div>
          <div className="analysis-status-card">
            <i className="bi bi-images" />
            <div>
              <span>{t("imagery.scene")}</span>
              <strong>{searched ? `${sortedScenes.length} ${t("imagery.found")}` : t("imagery.notSearched")}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className={`row g-3 analysis-settings-layout ${settingsCollapsed ? "settings-collapsed" : ""}`}>
        {settingsCollapsed ? (
          <div className="col-lg-auto analysis-settings-rail">
            <button
              type="button"
              className="analysis-settings-expand"
              onClick={() => setSettingsCollapsed(false)}
              aria-expanded={!settingsCollapsed}
              aria-label="Buka panel citra satelit"
              title="Buka panel citra satelit"
            >
              <i className="bi bi-chevron-double-right" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="col-lg-3">
        <div className="sidebar analysis-settings-panel">
          <button
            type="button"
            className="analysis-settings-collapse btn-light"
            onClick={() => setSettingsCollapsed(true)}
            aria-expanded={!settingsCollapsed}
            aria-label="Sembunyikan panel citra satelit"
            title="Sembunyikan panel citra satelit"
          >
            <i className="bi bi-chevron-double-left" aria-hidden="true" />
          </button>
          <h5 className="mb-3">
            <i className="bi bi-camera-fill" aria-hidden="true" /> {t("imagery.sidebarTitle")}
          </h5>
          <p className="text-muted small">
            {t("imagery.sidebarDescription")}
          </p>

          <div className="mb-3">
            <label className="form-label fw-bold">
              <i className="fas fa-map-marker-alt" /> {t("imagery.aoi")}
            </label>
            {aoi ? (
              <div className="alert alert-success py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-check-circle" /> {t("imagery.aoiDrawn")} ({aoi.geometry.type})
              </div>
            ) : isHimawari ? (
              <div className="alert alert-info py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-circle-info" /> Himawari mencakup area full-disk; AOI tidak diperlukan.
              </div>
            ) : (
              <div className="alert alert-info py-2 mb-0" style={{ fontSize: ".8rem" }}>
                <i className="fas fa-circle-info" /> Tanpa AOI, area peta yang terlihat dipakai untuk mencari scene.
              </div>
            )}
            <button type="button" className="btn btn-sm btn-outline-success w-100 mt-2" onClick={() => setAoiModalOpen(true)}>
              <i className="bi bi-bounding-box-circles" /> {t("imagery.selectDrawAoi")}
            </button>
            {aoi && (
              <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => setAoiState(null)}>
                <i className="fas fa-eraser" /> {t("imagery.removeAoi")}
              </button>
            )}
          </div>

          <hr />

          <div className="mb-3">
            <label className="form-label fw-bold">
              <i className="fas fa-calendar" /> {t("imagery.dateRange")}
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
              {isHimawari
                ? "Frame full-disk yang saat ini tersedia dari JMA akan dicari pada tanggal UTC yang dipilih."
                : isEsriWayback
                  ? "Rilis World Imagery Wayback di rentang ini akan dicari dan ditampilkan bertahap."
                  : "Semua scene asli di rentang ini akan dicari dan ditampilkan bertahap."}
            </small>
          </div>

          <div className="mb-3">
            <label className="form-label fw-bold" htmlFor="imagerySatellite">
              <i className="fas fa-satellite" /> {t("imagery.satellite")}
            </label>
            <SearchableSelect
              id="imagerySatellite"
              value={satellite}
              onChange={setSatellite}
              options={satelliteOptions}
            />
            {satelliteMeta && (
              <>
                {satelliteMeta.configuration_status && satelliteMeta.configuration_status !== "connected" && (
                  <div className="alert alert-warning py-1 px-2 mt-2 mb-0" style={{ fontSize: ".75rem" }}>
                    <i className="fas fa-lock" /> {satelliteMeta.configuration_message ?? `Provider berlisensi belum siap (${satelliteMeta.configuration_status}). Lengkapi konfigurasi backend.`}
                  </div>
                )}
                {satelliteMeta.configuration_status === "connected" && satelliteMeta.configuration_message && (
                  <div className="alert alert-info py-1 px-2 mt-2 mb-0" style={{ fontSize: ".75rem" }}>
                    <i className="fas fa-circle-info" /> {satelliteMeta.configuration_message}
                  </div>
                )}
                <small className="text-muted d-block mt-1">
                  {isEsriWayback
                    ? "Resolusi bervariasi (sering sub-meter hingga beberapa meter) · arsip rilis basemap sejak 2014"
                    : isHimawari
                      ? "Cakupan full-disk Asia-Pasifik · frame baru kira-kira tiap 10 menit · sejak 2015"
                      : [satelliteMeta.resolution_m == null ? null : formatResolution(satelliteMeta.resolution_m), satelliteMeta.revisit_days == null ? null : `revisit ~${satelliteMeta.revisit_days} hari`, satelliteMeta.start_year == null ? null : `sejak ${satelliteMeta.start_year}`].filter(Boolean).join(" · ") || "Resolusi, revisit, dan cakupan mengikuti produk/metadata scene."}
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
                {satelliteMeta.source_kind === "big_ctsrt" && (
                  <div className="alert alert-info py-1 px-2 mt-2 mb-0" style={{ fontSize: ".75rem" }}>
                    <i className="fas fa-circle-info" /> Mosaic CTSRT resmi BIG tersedia per wilayah/tahun. Hasil
                    pencarian akan memilih mosaic yang mencakup AOI, lalu merender citra dari ImageServer BIG.
                  </div>
                )}
              </>
            )}
          </div>

          {satelliteMeta?.key === "planet_commercial" && (
            <div className="mb-3">
              <label className="form-label fw-bold" htmlFor="imageryPlanetProduct">
                <i className="bi bi-collection" /> Produk Planet
              </label>
              <select
                id="imageryPlanetProduct"
                className="form-select form-select-sm"
                value={planetProduct}
                onChange={(event) => setPlanetProduct(event.target.value)}
              >
                <option value="all">Semua produk terkonfigurasi</option>
                {planetProductOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <small className="text-muted d-block mt-1">
                {planetProductOptions.length
                  ? "SkySat dan PlanetScope hanya muncul jika koleksi serta entitlement-nya tersedia pada akun Planet."
                  : "Untuk membuka filter PlanetScope/SkySat, admin perlu mengonfigurasi koleksi PSScene, SkySatScene, atau SkySatCollect dan akun Planet yang berhak."}
              </small>
            </div>
          )}

          {satelliteMeta?.key === "airbus_oneatlas" && (
            <div className="mb-3">
              <label className="form-label fw-bold" htmlFor="imageryAirbusConstellation">
                <i className="bi bi-collection" /> Konstelasi Airbus
              </label>
              <select
                id="imageryAirbusConstellation"
                className="form-select form-select-sm"
                value={airbusConstellation}
                onChange={(event) => setAirbusConstellation(event.target.value)}
              >
                <option value="">Semua produk yang tersedia di akun</option>
                <option value="PNEO">Pléiades Neo · sekitar 0,3 m</option>
                <option value="PHR">Pléiades · sekitar 0,5 m</option>
                <option value="SPOT">SPOT · sekitar 1,5 m</option>
              </select>
              <small className="text-muted d-block mt-1">
                Hasil bergantung pada cakupan archive dan hak akses workspace OneAtlas; filter ini hanya mencari scene.
              </small>
            </div>
          )}

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

          {satelliteMeta?.source_kind === "generic_stac" && (
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

          {/* Keep sibling accordion keys distinct so provider changes cannot reuse stale panel DOM. */}
          {supportsGpuEnhancement && <ProviderFeatureAccordion key={`gpu-${satellite}`} title={t("imagery.gpu.title")} icon="bi bi-gpu-card" variant="primary">
                <div className="form-check form-switch"><input className="form-check-input" type="checkbox" id="imageryGpuEnhancement" checked={visualEnhancement} onChange={(event) => setVisualEnhancement(event.target.checked)} /><label className="form-check-label fw-semibold" htmlFor="imageryGpuEnhancement"><small>{t("imagery.gpu.enable")}</small></label></div>
                <div className="row g-2 mt-1"><div className="col-7"><select className="form-select form-select-sm" value={gpuEnhancement.model} onChange={(event) => gpuEnhancement.setModel(event.target.value as "shader_x2" | "shader_x4")} disabled={!visualEnhancement} aria-label={t("imagery.gpu.modelAria")}><option value="shader_x2">{t("imagery.gpu.shaderSafe")}</option><option value="shader_x4">{t("imagery.gpu.shaderStrong")}</option></select></div><div className="col-5"><select className="form-select form-select-sm" value={gpuEnhancement.quality} onChange={(event) => gpuEnhancement.setQuality(event.target.value as "low" | "medium" | "high")} disabled={!visualEnhancement} aria-label={t("imagery.gpu.qualityAria")}><option value="low">{t("imagery.gpu.qualityLow")}</option><option value="medium">{t("imagery.gpu.qualityMedium")}</option><option value="high">{t("imagery.gpu.qualityHigh")}</option></select></div></div>
                <div className="small mt-2" aria-live="polite">Status: <strong>{gpuEnhancement.status}</strong> · Backend: <strong>{gpuEnhancement.backend}</strong>{gpuEnhancement.capabilities?.webgpu ? " (WebGPU tersedia; shader memakai jalur WebGL2 yang kompatibel)" : ""}</div>
                <div className="small text-muted mt-1">{t("imagery.gpu.hint")}</div>
                <div className="d-flex align-items-center gap-2 mt-2"><span className="small text-muted">Original</span><input type="range" className="form-range" min={0} max={1} step={0.05} value={gpuOpacity} onChange={(event) => setGpuOpacity(Number(event.target.value))} disabled={!visualEnhancement} aria-label="Perbandingan original enhanced" /><span className="small text-muted">Enhanced</span></div>
                {selectedScene && <div className="small mt-1"><strong>{satelliteMeta?.name ?? "Scene"}</strong> · Resolusi asli: {formatResolution(sceneResolution(selectedScene, cogAssetKey, satelliteMeta?.resolution_m))} · Enhancement: {visualEnhancement ? `GPU x${gpuEnhancement.model === "shader_x4" ? 4 : 2}` : "nonaktif"} · Mode: Visual only</div>}
                {visualEnhancement && gpuEnhancement.status === "fallback_original" && <div className="alert alert-warning py-1 px-2 mt-2 mb-0 small">GPU enhancement tidak tersedia pada perangkat ini. Citra original tetap ditampilkan.</div>}
                {visualEnhancement && gpuEnhancement.status === "error" && <div className="alert alert-danger py-1 px-2 mt-2 mb-0 small">Model visual gagal dimuat. Citra original tetap ditampilkan.</div>}
                <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={gpuEnhancement.clearCache}><i className="bi bi-trash3" /> Clear cache visual</button>
          </ProviderFeatureAccordion>}

          {supportsSuperResolution && <ProviderFeatureAccordion key={`interpolation-${satellite}`} title={t("imagery.interpolation")} icon="bi bi-stars">
            <label className="form-label fw-semibold" htmlFor="imagerySuperResolution">Metode interpolasi</label>
            <SearchableSelect
              id="imagerySuperResolution"
              value={activeSuperResolution}
              onChange={(value) => setSuperResolution(value as ImagerySuperResolutionMode)}
              disabled={!supportsSuperResolution}
              options={[
                { value: "off", label: "Nonaktif" },
                { value: "bicubic_2x", label: "Bicubic (visual saja)" },
              ]}
            />
            <small className="text-muted d-block mt-1">{t("imagery.interpolationHint")}</small>
          </ProviderFeatureAccordion>}

          {isCogProvider && supportsBandControls && (
            <ProviderFeatureAccordion key={`cog-${satellite}`} title="Pengaturan Tampilan COG" icon="bi bi-sliders">
              <label className="form-label fw-semibold" htmlFor="imageryCogAsset">Aset citra</label>
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
            </ProviderFeatureAccordion>
          )}

          {supportsSamGeo && <ProviderFeatureAccordion key={`samgeo-${satellite}`} title="Segmentasi AI (SAMGeo)" icon="bi bi-stars">
            <SamGeoPanel scene={selectedScene} aoi={aoi}
              assetKey={cogAssetKey} bands={cogBands} rescale={cogRescale}
              providerKey={satellite}
              onResult={setSegmentation} />
          </ProviderFeatureAccordion>}

          <ScientificCapabilitiesPanel support={scientificSupport} providerKey={satellite} />

          {!isHimawari && satelliteMeta?.visualization === "sar" && (
            <ProviderFeatureAccordion key={`sar-${satellite}`} title="Mode Tampilan SAR" icon="bi bi-satellite-dish">
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
            </ProviderFeatureAccordion>
          )}

          {isHimawari && (
            <div className="mb-3">
              <label className="form-label fw-bold" htmlFor="himawariOpacity">
                Opasitas frame Himawari
              </label>
              <div className="d-flex align-items-center gap-2">
                <input
                  id="himawariOpacity"
                  type="range"
                  className="form-range mb-0"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={himawariOpacity}
                  onChange={(event) => setHimawariOpacity(Number(event.target.value))}
                />
                <span className="small text-muted" style={{ minWidth: 38 }}>{Math.round(himawariOpacity * 100)}%</span>
              </div>
            </div>
          )}

          {!isHimawari && supportsCloudFilter && (
            <ProviderFeatureAccordion key={`cloud-${satellite}`} title={t("imagery.cloudFilter")} icon="bi bi-cloud">
              <div className="form-check form-switch mb-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="imageryCloudFilterSwitch"
                  checked={cloudFilterEnabled}
                  onChange={(e) => setCloudFilterEnabled(e.target.checked)}
                />
                <label className="form-check-label fw-bold" htmlFor="imageryCloudFilterSwitch">
                  <i className="fas fa-cloud" /> Terapkan filter awan
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
            </ProviderFeatureAccordion>
          )}

          <hr />

          {searchError && (
            <div className="alert alert-danger py-2 mb-2" style={{ fontSize: ".8rem" }}>
              {searchError}
            </div>
          )}

          <button className="btn btn-warning w-100 fw-bold" disabled={searching || !supportsSearch} onClick={searchScenes}>
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
        )}

      <div className={settingsCollapsed ? "col" : "col-lg-9"}>
        {isHimawari && (
          <div className="card border-info mb-3">
            <div className="card-body d-flex align-items-start gap-3">
              <i className="bi bi-cloud-sun text-info fs-3" aria-hidden="true" />
              <div>
                <h5 className="mb-1">Frame Himawari-9 full-disk</h5>
                <p className="text-muted mb-0">
                  Pilih rentang tanggal UTC lalu klik <strong>Cari Scene</strong>. Frame JMA akan muncul pada tabel
                  yang sama seperti Sentinel; pilih baris untuk menampilkan citra cuaca di peta. AOI tidak diperlukan.
                </p>
              </div>
            </div>
          </div>
        )}

        {!searched && !isHimawari && (
          <div className="card text-center py-5 border-dashed mb-3">
            <div className="card-body">
              <i className="bi bi-camera text-muted" style={{ fontSize: "3.5rem" }} />
              <h5 className="mt-3 text-muted">{t("imagery.search.emptyTitle")}</h5>
              <p className="text-muted mb-0">
                {t("imagery.search.emptyHint")} <strong>{t("imagery.search.button")}</strong>
              </p>
            </div>
          </div>
        )}

        {searched && (
          <div className="card mb-3">
            <div
              className="card-header imagery-accordion-card-header imagery-scene-results-header"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
                setSceneResultsOpen((open) => !open);
              }}
            >
              <button
                type="button"
                className="imagery-accordion-trigger"
                aria-expanded={sceneResultsOpen}
                aria-controls="imagerySceneResultsBody"
                onClick={(event) => {
                  event.stopPropagation();
                  setSceneResultsOpen((open) => !open);
                }}
              >
                <span className="imagery-accordion-copy">
                  <span className="imagery-accordion-title">
                    <i className="bi bi-list-ul" aria-hidden="true" /> <span>{t("imagery.search.found")}</span>
                    <span className="badge bg-secondary">{scenes.length}</span>
                    {truncated && (
                      <span className="badge bg-warning text-dark" title="Provider mencapai batas keamanan hasil; gunakan filter tanggal atau awan untuk mempersempit">
                        batas provider
                      </span>
                    )}
                  </span>
                </span>
                <i className={`bi bi-chevron-${sceneResultsOpen ? "up" : "down"} imagery-accordion-chevron`} aria-hidden="true" />
              </button>
              <div className="btn-group btn-group-sm ms-auto" role="group" aria-label="Mode tampilan">
                <button
                  type="button"
                  className={`btn text-white ${viewMode === "single" ? "btn-primary" : "btn-outline-secondary"}`}
                  onClick={() => setViewMode("single")}
                >
                  Satu Scene
                </button>
                {supportsCompare && (
                  <button
                    type="button"
                    className={`btn text-white ${viewMode === "compare" ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => setViewMode("compare")}
                  >
                    <i className="fas fa-arrows-alt-h" /> {t("imagery.compareTwo")}
                  </button>
                )}
              </div>
            </div>
            <div id="imagerySceneResultsBody" hidden={!sceneResultsOpen}>
            <div className="p-2 border-top border-bottom bg-body-tertiary">
              <div className="row g-2 align-items-center">
                <div className="col-md-8">
                  <label className="visually-hidden" htmlFor="scene-list-search">Cari scene</label>
                  <div className="input-group input-group-sm"><span className="input-group-text"><i className="fas fa-search" /></span><input id="scene-list-search" className="form-control" value={sceneSearch} onChange={(event) => setSceneSearch(event.target.value)} placeholder="Cari ID, judul, tanggal, platform, produser..." /><button type="button" className="btn btn-outline-secondary" disabled={!sceneSearch} onClick={() => setSceneSearch("")}>Bersihkan</button></div>
                </div>
                <div className="col-md-4 d-flex align-items-center gap-2 justify-content-md-end"><label className="small text-muted mb-0" htmlFor="scene-page-size">Per halaman</label><select id="scene-page-size" className="form-select form-select-sm" style={{ maxWidth: 90 }} value={scenePageSize} onChange={(event) => { setScenePageSize(Number(event.target.value)); setScenePage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></div>
              </div>
            </div>
            <div className="card-body p-0">
              {scenes.length === 0 ? (
                <div className="p-3 text-center text-muted small">
                  {isHimawari
                    ? "Tidak ada frame Himawari yang tersedia dari JMA pada rentang tanggal ini. Coba pilih tanggal lain."
                    : <>Tidak ada scene ditemukan untuk AOI/rentang/filter ini. Coba perlebar {t("imagery.dateRange")} atau nonaktifkan filter awan.</>}
                </div>
              ) : (
                <>
                <div className="table-responsive" style={{ maxHeight: 320, overflowY: "auto" }}>
                  <table className="table table-sm table-hover mb-0">
                    <thead className="table-primary sticky-top">
                      <tr>
                        <th>Tanggal &amp; Jam Akuisisi (UTC)</th>
                        {(supportsSceneMetadata || isHimawari) && (
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
                      {isMosaicProvider && (
                        <tr className={tileRenderMode === "mosaic" || mosaicRequested ? "table-success" : "table-light"}>
                          <td colSpan={3}>
                            <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                              <div>
                                <strong><i className="bi bi-grid-3x3-gap me-1" /> Grup Mosaik AOI</strong>
                                <small className="text-muted d-block">
                                  Gabungkan scene {satelliteMeta?.name ?? "provider ini"} yang ditemukan untuk mengisi AOI.
                                  {tileRenderMode === "mosaic" ? ` Aktif: ${tileSceneCount} scene.` : ""}
                                </small>
                              </div>
                              <button
                                type="button"
                                className={`btn btn-sm ${tileRenderMode === "mosaic" || mosaicRequested ? "btn-success" : "btn-outline-success"}`}
                                onClick={loadMosaicTile}
                                disabled={!(aoi || sceneSearchRegion || mapViewportAoi) || tileLoading}
                              >
                                {tileLoading && mosaicRequested ? <i className="fas fa-spinner fa-spin me-1" /> : <i className="bi bi-layers me-1" />}
                                Tampilkan Mosaik AOI
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {visibleScenes.map((scene) => (
                        <tr
                          key={scene.id}
                          className={selectedSceneId === scene.id ? "table-warning" : hoverSceneId === scene.id ? "table-info" : ""}
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => setHoverSceneId(scene.id)}
                          onMouseLeave={() => setHoverSceneId(null)}
                          onClick={() => selectScene(scene)}
                        >
                          <td>
                            {formatSceneDate(scene.acquired_at, isEsriWayback)}
                            {scene.title ? <small className="text-muted d-block">{scene.title}</small> : null}
                          </td>
                          {(supportsSceneMetadata || isHimawari) && (
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
                                title={isHimawari ? "Citra full-disk, tidak memiliki footprint scene" : "Zoom ke footprint scene"}
                                disabled={isHimawari}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  zoomToScene(scene);
                                }}
                              >
                                <i className="bi bi-zoom-in" />
                              </button>
                              {supportsDownload && scene.download_url && (
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
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 p-2 border-top">
                  <small className="text-muted">{filteredScenes.length === 0 ? "Tidak ada hasil" : `Menampilkan ${(scenePage - 1) * scenePageSize + 1}-${Math.min(scenePage * scenePageSize, filteredScenes.length)} dari ${filteredScenes.length} scene`}</small>
                  <nav aria-label="Paginasi scene"><div className="btn-group btn-group-sm"><button type="button" className="btn btn-outline-secondary" disabled={scenePage <= 1} onClick={() => setScenePage((page) => Math.max(1, page - 1))}>Sebelumnya</button><button type="button" className="btn btn-outline-secondary" disabled>{scenePage} / {scenePageCount}</button><button type="button" className="btn btn-outline-secondary" disabled={scenePage >= scenePageCount} onClick={() => setScenePage((page) => Math.min(scenePageCount, page + 1))}>Berikutnya</button></div></nav>
                </div>
                </>
              )}
            </div>
            </div>
          </div>
        )}

        {selectedScene && satelliteMeta && (
          <div className="card mb-3" aria-label="Data provenance scene terpilih">
            <div
              className="card-header imagery-accordion-card-header"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
                setProvenanceOpen((open) => !open);
              }}
            >
              <button
                type="button"
                className="imagery-accordion-trigger"
                aria-expanded={provenanceOpen}
                aria-controls="imageryProvenanceBody"
                onClick={(event) => {
                  event.stopPropagation();
                  setProvenanceOpen((open) => !open);
                }}
              >
                <span className="imagery-accordion-copy">
                  <span className="imagery-accordion-title"><i className="bi bi-info-circle" aria-hidden="true" /> <span>Data Provenance</span></span>
                </span>
                <i className={`bi bi-chevron-${provenanceOpen ? "up" : "down"} imagery-accordion-chevron`} aria-hidden="true" />
              </button>
              <span className="imagery-accordion-meta badge bg-light text-dark">
                {satelliteMeta.capabilities?.commercial ? "Commercial" : satelliteMeta.capabilities?.open_data ? "Open data" : "Provider access"}
              </span>
            </div>
            <div id="imageryProvenanceBody" className="card-body py-2 small" hidden={!provenanceOpen}>
              <div className="row g-2">
                <div className="col-md-4"><span className="text-muted d-block">Provider / mission</span><strong>{satelliteMeta.provider}</strong><span className="d-block">{satelliteMeta.name}</span></div>
                <div className="col-md-4"><span className="text-muted d-block">Scene ID</span><strong className="text-break">{selectedScene.id}</strong><span className="d-block">Platform: {selectedScene.platform ?? "-"}</span></div>
                <div className="col-md-4"><span className="text-muted d-block">{isEsriWayback ? "Tanggal rilis arsip" : "Akuisisi (UTC)"}</span><strong>{formatSceneDate(selectedScene.acquired_at, isEsriWayback)}</strong><span className="d-block">Resolusi native: {formatResolution(sceneResolution(selectedScene, cogAssetKey, satelliteMeta.resolution_m))}</span></div>
                <div className="col-md-4"><span className="text-muted d-block">Tutupan awan</span><strong>{selectedScene.cloud_cover_pct == null ? "Tidak tersedia / tidak relevan" : `${selectedScene.cloud_cover_pct}%`}</strong></div>
                <div className="col-md-4"><span className="text-muted d-block">Produk / asset</span><strong>{selectedScene.collection ?? satelliteMeta.stac_collection ?? satelliteMeta.gee_collection ?? selectedScene.title ?? (isEsriWayback ? "Esri World Imagery Wayback" : "Provider scene")}</strong><span className="d-block">{activeCogAsset ? `Asset: ${activeCogAsset.title || activeCogAsset.key}` : "Asset tile provider"}</span></div>
                <div className="col-md-4"><span className="text-muted d-block">Attribution / lisensi</span><strong>{isEsriWayback ? "Esri World Imagery Wayback" : satelliteMeta.provider}</strong><span className="d-block">{satelliteMeta.license ?? "Gunakan sesuai ketentuan sumber."}</span></div>
              </div>
              {isEsriWayback && <div className="alert alert-info py-1 px-2 mt-2 mb-0">Tanggal di atas adalah tanggal rilis Wayback (referensi visual), bukan jaminan tanggal akuisisi sensor.</div>}
            </div>
          </div>
        )}

        {viewMode === "single" && (
          <>
            {tileError && <div className="alert alert-danger py-2 mb-3">{tileError}</div>}
            {tileRenderMode !== "mosaic" && selectedScene?.cloud_cover_pct != null && selectedScene.cloud_cover_pct > 60 && (
              <div className="alert alert-warning py-2 mb-3 small">
                <i className="bi bi-cloud-haze2 me-1" />
                Scene ini sangat berawan ({selectedScene.cloud_cover_pct}%). Tampilan abu-abu/pudar berasal dari citra
                asli pada tanggal tersebut, bukan komposit bebas awan. Aktifkan {t("imagery.cloudFilter")} atau pilih scene
                dengan badge hijau untuk visual yang lebih jelas.
              </div>
            )}
            {tileLoading && (
              <div className="alert alert-info py-2 mb-3">
                <i className="fas fa-spinner fa-spin" /> Memuat citra scene...
              </div>
            )}
            {!tileLoading && tileUrl && tileRenderMode === "mosaic" && (
              <div className="alert alert-info py-2 mb-3 small">
                <i className="bi bi-grid-3x3-gap me-1" />
                Menampilkan mosaik {satelliteMeta?.name ?? "provider ini"} dari {tileSceneCount} scene
                pada rentang tanggal yang dipilih{supportsCloudFilter ? " dan filter awan yang dipilih." : "."}
              </div>
            )}

            <div className="card">
              <div className="card-header imagery-accordion-card-header">
                <button
                  type="button"
                  className="imagery-accordion-trigger"
                  aria-expanded={mapOpen}
                  aria-controls="imageryMapBody"
                  onClick={() => setMapOpen((open) => !open)}
                >
                  <span className="imagery-accordion-copy">
                    <span className="imagery-accordion-title"><i className="bi bi-map" aria-hidden="true" /> <span>Peta</span></span>
                    {selectedSceneId && (
                      <span className="imagery-accordion-scene">
                        {tileRenderMode === "mosaic"
                          ? `- mosaik ${tileSceneCount} scene pada rentang tanggal`
                          : `- menampilkan scene ${formatSceneDate(scenes.find((s) => s.id === selectedSceneId)?.acquired_at ?? "", isEsriWayback)}`}
                      </span>
                    )}
                    {himawariTimeLayerUrl && (
                      <span className="imagery-accordion-scene">- frame Himawari-9 JMA ditampilkan</span>
                    )}
                  </span>
                  <i className={`bi bi-chevron-${mapOpen ? "up" : "down"} imagery-accordion-chevron`} aria-hidden="true" />
                </button>
              </div>
              <div id="imageryMapBody" className="card-body p-2" hidden={!mapOpen}>
                {mapMode === "globe" ? (
                  <GlobeView
                    id="imageryGlobe"
                    basemapId={globeBasemapId}
                    center={[globeCamera.lat, globeCamera.lng]}
                    zoom={globeCamera.zoom}
                    aoi={aoi as GeoJSON.Feature | null}
                    layers={globeLayers}
                    onBasemapChange={setGlobeBasemapId}
                    onViewChange={setMapMode}
                  />
                ) : (
                  <MapView id="imagerySceneMap" maxZoom={SCENE_TILE_MAX_ZOOM} historicalDate={isHimawari ? undefined : selectedScene?.acquired_at?.slice(0, 10)} historicalAoi={isHimawari ? null : aoi}>
                    <ImageryMapViewportReporter onChange={setMapViewportAoi} />
                    <BasemapSwitcher extraOptions={mapLayerOptions} />
                    {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
                    <SceneFootprintLayer
                      data={footprintData}
                      onHover={setHoverSceneId}
                      onSelect={(sceneId) => {
                        const scene = sceneId === "latest"
          ? [...scenes].filter(s => Number.isFinite(Date.parse(s.acquired_at))).sort((a, b) => Date.parse(b.acquired_at) - Date.parse(a.acquired_at))[0]
          : scenes.find((item) => item.id === sceneId);
                        if (scene) selectScene(scene);
                      }}
                    />
                    {segmentation && <GeoJSON key={JSON.stringify(segmentation)} data={segmentation}
                      style={{ color: "#e83e8c", weight: 2, fillOpacity: 0.18 }} />}
                    {nasaTimeLayerUrl && <TileLayer key={nasaTimeLayerUrl} url={nasaTimeLayerUrl} opacity={0.55} attribution="NASA GIBS / Earthdata" pane={RESULT_PANE} />}
                    {himawariTimeLayerUrl && <TileLayer key={himawariTimeLayerUrl} url={himawariTimeLayerUrl} opacity={himawariOpacity} attribution="JMA Himawari-9" maxNativeZoom={5} maxZoom={SCENE_TILE_MAX_ZOOM} pane={RESULT_PANE} />}
                    {tileUrl && (
                      <>
                        {isEsriWayback ? (
                          <ParentFallbackTileLayer
                            key={`${selectedSceneId ?? "scene"}:${tileUrl}:${sceneTileMaxNativeZoom}`}
                            url={tileUrl}
                            opacity={tileOpacity}
                            attribution="Esri World Imagery Wayback"
                            maxNativeZoom={sceneTileMaxNativeZoom}
                            maxZoom={SCENE_TILE_MAX_ZOOM}
                            pane={aoi ? "historical-imagery" : RESULT_PANE}
                          />
                        ) : (
                          <TileLayer
                            key={`${selectedSceneId ?? "scene"}:${tileUrl}:${sceneTileMaxNativeZoom}`}
                            url={tileUrl}
                            opacity={tileOpacity}
                            attribution={
                            satelliteMeta?.source_kind === "oam_stac"
                              ? "OpenAerialMap / HOT"
                              : satelliteMeta?.source_kind === "maxar_open_data_stac"
                                ? "Vantor/Maxar Open Data"
                              : satelliteMeta?.source_kind === "planet_open_data_stac"
                                  ? "Planet Open Data"
                                  : satelliteMeta?.source_kind === "oneatlas_data_api"
                                    ? "Airbus OneAtlas Data"
                                  : satelliteMeta?.source_kind === "planet_stac"
                                    ? "Planet commercial"
                                    : satelliteMeta?.source_kind === "vantor_stac"
                                      ? "Vantor/Maxar commercial"
                                      : satelliteMeta?.source_kind === "iceye_stac"
                                        ? "ICEYE"
                                  : satelliteMeta?.source_kind === "generic_stac"
                                    ? "STAC/COG source"
                                    : satelliteMeta?.source_kind === "big_ctsrt"
                                      ? "BIG / CTSRT"
                                      : isEsriWayback
                                        ? "Esri World Imagery Wayback"
                                        : "Google Earth Engine"
                            }
                            maxNativeZoom={sceneTileMaxNativeZoom}
                            maxZoom={SCENE_TILE_MAX_ZOOM}
                            pane={RESULT_PANE}
                          />
                        )}
                        {effectiveVisualEnhancement && (
                          <GpuEnhancedTileLayer
                            key={`gpu:${selectedSceneId ?? "scene"}:${tileUrl}:${gpuEnhancement.model}:${gpuEnhancement.quality}:${gpuEnhancement.cacheVersion}`}
                            url={tileUrl}
                            opacity={tileOpacity * gpuOpacity}
                            pane={RESULT_PANE}
                            maxNativeZoom={sceneTileMaxNativeZoom}
                            maxZoom={SCENE_TILE_MAX_ZOOM}
                            model={gpuEnhancement.model}
                            quality={gpuEnhancement.quality}
                            onStatus={setGpuTileStatus}
                          />
                        )}
                        <RasterResolutionNotice layers={[{label: tileRenderMode === "mosaic" ? `${satelliteMeta?.name ?? "Sentinel-2"} · Mosaik` : satelliteMeta?.name ?? "Scene", resolutionM: sceneResolution(selectedScene ?? undefined, cogAssetKey, satelliteMeta?.resolution_m), nativeZoom: sceneTileMaxNativeZoom, tileUrl}]} />
                        <LayerOpacityControl opacity={tileOpacity} onChange={setTileOpacity} label="Opacity scene" />
                        {effectiveVisualEnhancement && <div className="small text-muted mt-1">GPU tile status: {gpuTileStatus}. Data analitik tetap memakai citra native.</div>}
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
                      aoi={aoi ?? sceneSearchRegion}
                      focusKey={`${focusSceneId ?? "aoi"}:${focusNonce}`}
                      scene={focusScene}
                      maxZoom={sceneFocusMaxZoom}
                    />
                  </MapView>
                )}
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
                {selectedScene && supportsAnalyticalTools && <ImageryToolsPanel scene={selectedScene} aoi={aoi} assetKey={cogAssetKey}
                  activeNasaLayerUrl={nasaTimeLayerUrl} storyMap={storyMap}
                  onNasaLayer={setNasaTimeLayerUrl} onStory={setStoryMap} mapMode={mapMode} onMapMode={setMapMode} />}
                {storyMap && <a className="btn btn-sm btn-outline-success mt-2" download="story-map.geojson"
                  href={`data:application/geo+json;charset=utf-8,${encodeURIComponent(JSON.stringify(storyMap))}`}>
                  <i className="bi bi-download" /> Download Story Map GeoJSON
                </a>}
              </div>
            </div>
          </>
        )}

        {viewMode === "compare" && supportsCompare && searched && (
          <>
            <div className="card mb-3">
              <div className="card-header py-2">
                <i className="bi bi-arrows-alt-h" /> Pilih 2 Waktu untuk Dibandingkan
              </div>
              <div className="card-body">
                <div className="row g-2 mb-2">
                  <div className="col-sm-6">
                    <label className="form-label small fw-semibold mb-1">Scene A</label>
                    <SearchableSelect
                      value={compareSceneAId ?? ""}
                      onChange={(v) => setCompareSceneAId(v || null)}
                      options={sortedScenes.map((s) => ({
                        value: s.id,
                        label: `${formatSceneDate(s.acquired_at, isEsriWayback)}${s.cloud_cover_pct != null ? ` · awan ${s.cloud_cover_pct}%` : ""}`,
                      }))}
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label small fw-semibold mb-1">Scene B</label>
                    <SearchableSelect
                      value={compareSceneBId ?? ""}
                      onChange={(v) => setCompareSceneBId(v || null)}
                      options={sortedScenes.map((s) => ({
                        value: s.id,
                        label: `${formatSceneDate(s.acquired_at, isEsriWayback)}${s.cloud_cover_pct != null ? ` · awan ${s.cloud_cover_pct}%` : ""}`,
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
                    beforeLabel={formatSceneDate(scenes.find((s) => s.id === compareSceneAId)?.acquired_at ?? "", isEsriWayback)}
                    afterLabel={formatSceneDate(scenes.find((s) => s.id === compareSceneBId)?.acquired_at ?? "", isEsriWayback)}
                    orientation={compareOrientation}
                    onOrientationChange={setCompareOrientation}
                    maxNativeZoom={sceneTileMaxNativeZoom}
                    beforeResolutionM={sceneResolution(scenes.find(s => s.id === compareSceneAId), cogAssetKey, satelliteMeta?.resolution_m) ?? undefined}
                    afterResolutionM={sceneResolution(scenes.find(s => s.id === compareSceneBId), cogAssetKey, satelliteMeta?.resolution_m) ?? undefined}
                    beforeMaxNativeZoom={nativeZoomForResolution(sceneResolution(scenes.find(s => s.id === compareSceneAId), cogAssetKey, satelliteMeta?.resolution_m))}
                    afterMaxNativeZoom={nativeZoomForResolution(sceneResolution(scenes.find(s => s.id === compareSceneBId), cogAssetKey, satelliteMeta?.resolution_m))}
                    maxZoom={SCENE_TILE_MAX_ZOOM}
                    fallbackToParentTiles={isEsriWayback}
                    bounds={sceneSearchRegion ? L.geoJSON(sceneSearchRegion as GeoJSON.Feature).getBounds() : undefined}
                    clipGeometry={aoi as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null}
                  >
                    {aoi && <GeoJSON key={JSON.stringify(aoi.geometry)} data={aoi as GeoJSON.Feature} style={AOI_STYLE} />}
                    <FitToSceneOrAoi
                      aoi={aoi ?? sceneSearchRegion}
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
        title={t("imagery.aoiModalTitle")}
        description="Pilih wilayah administrasi, koordinat, gambar polygon/rectangle, unggah file, atau pilih batas perusahaan."
        aoi={aoiState}
        onAoiChange={setAoiState}
        onClose={() => setAoiModalOpen(false)}
      />
    </div>
  );
}
