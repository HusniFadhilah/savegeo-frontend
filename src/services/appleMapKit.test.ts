import L from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BasemapDefinition } from "@/types/map";

const get = vi.fn();
vi.mock("@/services/apiClient", () => ({ apiClient: { get: (...args: unknown[]) => get(...args) } }));

const base: BasemapDefinition = { id: "satellite", name: "Esri", url: "https://tiles.test/{z}/{x}/{y}", attribution: "Esri", maxZoom: 19, isDefault: true, order: 1 };

async function freshModule() {
  vi.resetModules();
  return import("./appleMapKit");
}

afterEach(() => {
  get.mockReset();
});

describe("mapRectForView", () => {
  it("maps Leaflet pixel bounds to normalized Web Mercator", async () => {
    const { mapRectForView } = await freshModule();
    // At zoom 1 the world is 512 px; the eastern half spans x 256..512.
    expect(mapRectForView(L.bounds([256, 0], [512, 512]), 1)).toEqual([0.5, 0, 0.5, 1]);
    const map = L.CRS.EPSG3857;
    const zoom = 10;
    const center = map.latLngToPoint(L.latLng(-6.2, 106.8), zoom);
    const [x, y, width, height] = mapRectForView(L.bounds(center.subtract([400, 300]), center.add([400, 300])), zoom);
    expect(x + width / 2).toBeCloseTo((106.8 + 180) / 360, 6);
    expect(width).toBeCloseTo(800 / (256 * 2 ** zoom), 9);
    expect(height).toBeCloseTo(600 / (256 * 2 ** zoom), 9);
    expect(y).toBeGreaterThan(0.5); // southern hemisphere lies below the equator
  });
});

describe("withOptionalAppleBasemaps", () => {
  it("adds Apple basemaps only when the backend issues a token", async () => {
    get
      .mockResolvedValueOnce({ available: true })
      .mockResolvedValueOnce({ token: "t", expires_at: Date.now() / 1000 + 1800 });
    const { withOptionalAppleBasemaps } = await freshModule();
    const result = await withOptionalAppleBasemaps([base]);
    expect(get).toHaveBeenNthCalledWith(1, "/maps/apple-mapkit/status");
    expect(get).toHaveBeenNthCalledWith(2, "/maps/apple-mapkit/token");
    expect(result.map((item) => item.id)).toEqual(["satellite", "apple-satellite", "apple-hybrid"]);
    expect(result.filter((item) => item.renderer === "mapkit").map((item) => item.mapkitType)).toEqual(["satellite", "hybrid"]);
  });

  it("keeps the list unchanged when Apple MapKit is not configured", async () => {
    get.mockRejectedValueOnce(new Error("503"));
    const { withOptionalAppleBasemaps } = await freshModule();
    expect(await withOptionalAppleBasemaps([base])).toEqual([base]);
  });

  it("reuses a valid token instead of requesting a new one", async () => {
    get.mockResolvedValue({ token: "t", expires_at: Date.now() / 1000 + 1800 });
    const { fetchAppleMapKitToken } = await freshModule();
    await fetchAppleMapKitToken();
    await fetchAppleMapKitToken();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
