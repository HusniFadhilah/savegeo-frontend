import type L from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fitBoundsSafe, getActiveMap, registerMap, registerVisibleMap, setMapView, waitForActiveMap } from "./mapActions";
import { getPageState } from "./pageContext";

describe("chatbot map registry", () => {
  afterEach(() => {
    registerMap("results", null);
    registerMap("aoi", null);
    document.body.replaceChildren();
  });

  it("ignores a detached map and uses the attached map for page state", () => {
    const detachedMap = {
      getContainer: () => document.createElement("div"),
      getCenter: vi.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading '_leaflet_pos')");
      }),
      getZoom: vi.fn(() => 12),
    } as unknown as L.Map;
    const attachedContainer = document.createElement("div");
    document.body.appendChild(attachedContainer);
    const attachedMap = {
      getContainer: () => attachedContainer,
      getCenter: vi.fn(() => ({ lat: -6.2, lng: 106.8 })),
      getZoom: vi.fn(() => 8),
    } as unknown as L.Map;

    registerMap("aoi", attachedMap);
    registerMap("results", detachedMap);

    const state = getPageState();

    expect(state.map).toEqual({ center: [-6.2, 106.8], zoom: 8 });
    expect(getActiveMap()).toBe(attachedMap);
    expect(detachedMap.getCenter).not.toHaveBeenCalled();
  });
});

it("does not navigate a hidden module when another module has no map", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const map = { getContainer: () => container } as unknown as L.Map;
  registerMap("results", map);
  const dispose = registerVisibleMap(map, false);
  try { expect(getActiveMap()).toBeNull(); }
  finally { dispose(); registerMap("results", null); container.remove(); }
});

describe("map controller lifecycle", () => {
  it("never returns a map whose container was removed", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const map = { getContainer: () => container } as unknown as L.Map;
    registerMap("aoi", map);
    expect(getActiveMap()).toBe(map);
    container.remove();
    expect(getActiveMap()).toBeNull();
    registerMap("aoi", null);
  });

  it("waitForActiveMap resolves when a map registers and null on timeout", async () => {
    const none = await waitForActiveMap(20);
    expect(none).toBeNull();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const map = { getContainer: () => container } as unknown as L.Map;
    const pending = waitForActiveMap(1000);
    registerMap("aoi", map);
    await expect(pending).resolves.toBe(map);
    registerMap("aoi", null);
    container.remove();
  });

  it("fitBoundsSafe rejects non-finite bounds instead of calling Leaflet", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const fitBounds = vi.fn();
    const map = { getContainer: () => container, fitBounds, getMinZoom: () => 0, getMaxZoom: () => 18 } as unknown as L.Map;
    registerMap("aoi", map);
    const bad = { isValid: () => true, getSouth: () => NaN, getNorth: () => 1, getWest: () => 0, getEast: () => 1 } as unknown as L.LatLngBounds;
    expect(fitBoundsSafe(bad)).toBe(false);
    expect(fitBounds).not.toHaveBeenCalled();
    registerMap("aoi", null);
    container.remove();
  });

  it("setMapView rejects zoom outside the map's limits", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const setView = vi.fn();
    const map = { getContainer: () => container, setView, getMinZoom: () => 2, getMaxZoom: () => 18 } as unknown as L.Map;
    registerMap("aoi", map);
    expect(() => setMapView([-7, 110], 30)).toThrow(/tidak valid/);
    expect(() => setMapView([-97, 110], 8)).toThrow(/tidak valid/);
    expect(setView).not.toHaveBeenCalled();
    registerMap("aoi", null);
    container.remove();
  });
});
