import { describe, expect, it } from "vitest";
import { parseModuleQuery, serializeModuleQuery, updateModuleUrl } from "@/lib/moduleQueryState";
import { tileTemplate, imageryProvider } from "./imagery";
import { cameraNumber } from "./query";
import { FALLBACK_BASEMAPS } from "@/config/basemaps";
describe("globe adapters", () => {
  it("roundtrips 3D state while preserving module/AOI selection", () => {
    const value = "view=3d&aoi_id=12&dataset=sentinel2&show_terrain=true&show_buildings=false&show_roads=true&globe_height=50000&globe_pitch=-45&globe_roll=10&terrain_exaggeration=2";
    const state = parseModuleQuery(value);
    expect(parseModuleQuery(serializeModuleQuery(state).toString())).toEqual(state);
    expect(state).toMatchObject({ view: "3d", aoiId: 12, globeHeight: 50000, globePitch: -45, showTerrain: true });
  });
  it("does not let analysis state erase the active globe or camera", () => {
    window.history.replaceState({ idx: 3 }, "", "/carbon-estimation?view=3d&globe_height=5000&show_terrain=false");
    updateModuleUrl("/carbon-estimation", { view: "single", year: 2026 });
    expect(new URLSearchParams(window.location.search).get("view")).toBe("3d");
    expect(new URLSearchParams(window.location.search).get("globe_height")).toBe("5000");
    expect(window.history.state).toEqual({ idx: 3 });
  });
  it("keeps Esri z/y/x and ordinary XYZ template order", () => {
    expect(tileTemplate("https://esri/tile/{z}/{y}/{x}")).toBe("https://esri/tile/{z}/{y}/{x}");
    expect(tileTemplate("https://{s}.carto/{z}/{x}/{y}{r}.png")).toBe("https://{s}.carto/{z}/{x}/{y}.png");
  });
  it("constructs all configured XYZ providers with their attribution and native zoom", () => {
    for (const base of FALLBACK_BASEMAPS) {
      const provider = imageryProvider(base.url, base.attribution, base.maxNativeZoom ?? base.maxZoom);
      expect(provider.url).toBe(tileTemplate(base.url));
      expect(provider.credit?.html).toBe(base.attribution);
      expect(provider.maximumLevel).toBe(base.maxNativeZoom ?? base.maxZoom);
    }
  });
  it("rejects invalid camera and elevation bounds", () => {
    expect(cameraNumber(new URLSearchParams("globe_height=-30"), "globe_height", 5000, 20, 40000000)).toBe(5000);
    expect(parseModuleQuery("terrain_exaggeration=100&globe_lat=NaN").terrainExaggeration).toBeUndefined();
  });
});
