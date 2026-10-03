/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_CESIUM_ION_TOKEN?: string;
  readonly VITE_CESIUM_TERRAIN_ASSET_ID?: string;
  readonly VITE_CESIUM_TERRAIN_URL?: string;
  readonly VITE_CESIUM_BUILDINGS_ASSET_ID?: string;
  readonly VITE_CESIUM_BUILDINGS_URL?: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_ENV: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
