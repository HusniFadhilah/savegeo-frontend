import { describe, expect, it } from "vitest";
import { wildfireEventIsland } from "./eventRegions";
import { FALLBACK_WILDFIRE_EVENTS } from "./data";

describe("wildfire event regional coverage", () => {
  it("uses the matching island for province filters", () => {
    expect(wildfireEventIsland("sumatra-2026")).toBe("Sumatra");
    expect(wildfireEventIsland("kalimantan-2026")).toBe("Kalimantan");
    expect(wildfireEventIsland("another-event")).toBeUndefined();
  });
  it("includes ten Sumatra provinces and eastern Kepulauan Riau", () => {
    const event = FALLBACK_WILDFIRE_EVENTS.find((item) => item.slug === "sumatra-2026")!;
    expect(event.province_codes).toEqual(["11", "12", "13", "14", "15", "16", "17", "18", "19", "21"]);
    expect(event.provinces).toHaveLength(10);
    expect(event.bbox[2]).toBeGreaterThan(109.1);
    expect(event.bbox[1]).toBeLessThan(-5.93);
  });
});
