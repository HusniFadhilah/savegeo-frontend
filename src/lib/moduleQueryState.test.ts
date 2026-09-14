import { describe, expect, it } from "vitest";
import { parseModuleQuery, serializeModuleQuery, buildModuleShareUrl } from "./moduleQueryState";

describe("module query state", () => {
  it("parses and validates common parameters", () => {
    const s = parseModuleQuery("?aoi_id=12&year_from=2018&year_to=2026&opacity=2&view=swipe&index=NDVI");
    expect(s.aoiId).toBe(12); expect(s.yearFrom).toBe(2018); expect(s.yearTo).toBe(2026);
    expect(s.opacity).toBeUndefined(); expect(s.view).toBe("swipe"); expect(s.index).toBe("ndvi");
  });
  it("round trips state and never adds credentials", () => {
    const q = serializeModuleQuery({ aoiId: 3, dataset: "dynamic_world", changeMode: "destination", opacity: .85 });
    expect(q.get("aoi_id")).toBe("3"); expect(q.get("opacity")).toBe("0.85");
    expect(q.toString()).not.toMatch(/token|password|secret/i);
    expect(buildModuleShareUrl("/land-cover-change", { dataset: "dynamic_world" })).toContain("dataset=dynamic_world");
  });
  it("round trips visual enhancement preferences without imagery data", () => {
    const state = parseModuleQuery("?enhance=true&enhance_model=shader_x2&enhance_scale=2&enhance_backend=webgl2&show_original=false");
    expect(state.enhance).toBe(true);
    expect(state.enhanceModel).toBe("shader_x2");
    expect(state.enhanceScale).toBe(2);
    expect(state.showOriginal).toBe(false);
    const query = serializeModuleQuery(state);
    expect(query.get("enhance")).toBe("true");
    expect(query.toString()).not.toMatch(/data:image|token|password|secret/i);
  });
});
