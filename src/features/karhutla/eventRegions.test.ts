import { describe, expect, it } from "vitest";
import { wildfireEventIsland, wildfireEventRegionLabel } from "./eventRegions";
import { FALLBACK_WILDFIRE_EVENTS } from "./data";

describe("wildfire event regional coverage", () => {
  it("uses the matching island for province filters", () => {
    expect(wildfireEventIsland("sumatra-2026")).toBe("Sumatra");
    expect(wildfireEventIsland("kalimantan-2026")).toBe("Kalimantan");
    expect(wildfireEventIsland("another-event")).toBeUndefined();
    expect(wildfireEventIsland("constructor")).toBeUndefined();
    expect(wildfireEventIsland("jawa-2026")).toBe("Jawa");
    expect(wildfireEventIsland("sulawesi-2026")).toBe("Sulawesi");
    expect(wildfireEventIsland("bali-nusa-tenggara-2026")).toBe("Bali_Nusa_Tenggara");
    expect(wildfireEventIsland("maluku-2026")).toBe("Maluku");
    expect(wildfireEventIsland("papua-2026")).toBe("Papua");
    expect(wildfireEventRegionLabel("bali-nusa-tenggara-2026")).toBe("Bali & Nusa Tenggara");
    expect(wildfireEventIsland("all")).toBeUndefined();
    expect(wildfireEventRegionLabel("all")).toBe("Indonesia");
  });
  it("includes ten Sumatra provinces and eastern Kepulauan Riau", () => {
    const event = FALLBACK_WILDFIRE_EVENTS.find((item) => item.slug === "sumatra-2026")!;
    expect(event.province_codes).toEqual(["11", "12", "13", "14", "15", "16", "17", "18", "19", "21"]);
    expect(event.provinces).toHaveLength(10);
    expect(event.bbox[2]).toBeGreaterThan(109.1);
    expect(event.bbox[1]).toBeLessThan(-5.93);
  });
  it("provides a country-wide monitoring event", () => {
    const event = FALLBACK_WILDFIRE_EVENTS.find((item) => item.slug === "all")!;
    expect(event.title).toContain("Seluruh Indonesia");
    expect(event.bbox).toEqual([94, -11.5, 142, 7]);
    expect(event.province_codes).toHaveLength(38);
  });
});
