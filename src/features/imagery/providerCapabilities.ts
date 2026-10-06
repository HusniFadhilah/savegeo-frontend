import type { ImageryProvider } from "./types";

export interface ImageryUiCapabilities {
  search: boolean;
  preview: boolean;
  compare: boolean;
  download: boolean;
  mosaic: boolean;
  sceneMetadata: boolean;
  cog: boolean;
  bands: boolean;
  analysis: boolean;
  superResolution: boolean;
  visualEnhancement: boolean;
  cloudFilter: boolean;
}

/** Derive scene-browser controls from the server's declared provider capabilities. */
export function getImageryUiCapabilities(provider: ImageryProvider | undefined): ImageryUiCapabilities {
  const capabilities = provider?.capabilities;
  const previewKind = capabilities?.preview_kind;
  const search = capabilities?.searchable !== false && (
    !capabilities?.commercial || provider?.configuration_status === "connected"
  );
  const preview = capabilities?.supports_preview !== false;
  const analysis = capabilities?.analytical !== false;
  const visualEnhancement = capabilities?.supports_visual_enhancement !== false;

  return {
    search,
    preview,
    compare: capabilities?.supports_compare !== false,
    download: capabilities?.downloadable !== false,
    mosaic: Boolean(capabilities?.supports_mosaic ?? provider?.supports_mosaic),
    sceneMetadata: Boolean(capabilities?.supports_scene_metadata),
    cog: previewKind === "cog",
    bands: capabilities?.supports_bands !== false,
    analysis,
    superResolution: analysis && visualEnhancement && previewKind === "gee",
    visualEnhancement: analysis && visualEnhancement && provider?.visualization === "rgb",
    cloudFilter: Boolean(provider?.cloud_property && capabilities?.supports_cloud_filter !== false),
  };
}
