import { describe, expect, it } from "vitest";
import type { ImageryProvider } from "./types";
import { getImageryUiCapabilities } from "./providerCapabilities";

function provider(overrides: Partial<ImageryProvider>): ImageryProvider {
  return {
    key: "test",
    name: "Test provider",
    provider: "Test",
    group: "Commercial EO",
    gee_collection: "",
    visualization: "rgb",
    resolution_m: null,
    revisit_days: null,
    start_year: null,
    cloud_property: null,
    ...overrides,
  };
}

describe("imagery provider UI capabilities", () => {
  it("limits OneAtlas to configured search, provider preview, and comparison", () => {
    const ui = getImageryUiCapabilities(provider({
      key: "airbus_oneatlas",
      configuration_status: "connected",
      capabilities: {
        searchable: true,
        downloadable: false,
        analytical: false,
        visualization_only: true,
        supports_time: true,
        supports_cloud_filter: true,
        supports_bands: false,
        supports_raw_data: false,
        supports_ai: false,
        requires_authentication: true,
        commercial: true,
        open_data: false,
        supports_preview: true,
        supports_compare: true,
        supports_mosaic: false,
        supports_visual_enhancement: false,
        supports_scene_metadata: true,
        preview_kind: "provider_tiles",
      },
    }));

    expect(ui).toMatchObject({
      search: true,
      preview: true,
      compare: true,
      download: false,
      mosaic: false,
      sceneMetadata: true,
      cog: false,
      analysis: false,
      superResolution: false,
      visualEnhancement: false,
    });
  });

  it("disables all scene actions for the unconfigured BlackSky placeholder", () => {
    const ui = getImageryUiCapabilities(provider({
      key: "blacksky_spectra",
      configuration_status: "not_configured",
      capabilities: {
        searchable: false,
        downloadable: false,
        analytical: false,
        visualization_only: true,
        supports_time: true,
        supports_cloud_filter: false,
        supports_bands: false,
        supports_raw_data: false,
        supports_ai: false,
        requires_authentication: true,
        commercial: true,
        open_data: false,
        supports_preview: false,
        supports_compare: false,
        supports_mosaic: false,
        supports_visual_enhancement: false,
        supports_scene_metadata: false,
        preview_kind: null,
      },
    }));

    expect(ui).toMatchObject({
      search: false,
      preview: false,
      compare: false,
      download: false,
      mosaic: false,
      cog: false,
      analysis: false,
      superResolution: false,
      visualEnhancement: false,
    });
  });

  it("hides commercial actions while configuration is incomplete and retains Planet COG controls when connected", () => {
    const planet = provider({
      key: "planet_commercial",
      configuration_status: "connected",
      cloud_property: "eo:cloud_cover",
      capabilities: {
        searchable: true,
        downloadable: true,
        analytical: false,
        visualization_only: true,
        supports_time: true,
        supports_cloud_filter: true,
        supports_bands: true,
        supports_raw_data: true,
        supports_ai: false,
        requires_authentication: true,
        commercial: true,
        open_data: false,
        preview_kind: "cog",
      },
    });

    expect(getImageryUiCapabilities({ ...planet, configuration_status: "incomplete_configuration" }).search).toBe(false);
    expect(getImageryUiCapabilities(planet)).toMatchObject({
      search: true,
      preview: true,
      compare: true,
      download: true,
      cog: true,
      bands: true,
      cloudFilter: true,
      analysis: false,
      superResolution: false,
    });
  });
});
