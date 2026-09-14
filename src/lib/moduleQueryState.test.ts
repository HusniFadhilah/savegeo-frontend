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
});
