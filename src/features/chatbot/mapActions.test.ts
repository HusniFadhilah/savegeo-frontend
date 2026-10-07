import type L from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveMap, registerMap, registerVisibleMap } from "./mapActions";
import { getPageState } from "./windowBridge";

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
