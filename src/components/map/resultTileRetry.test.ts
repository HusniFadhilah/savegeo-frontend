import { afterEach, expect, it, vi } from "vitest";
import type L from "leaflet";
import { installResultTileRetry } from "./resultTileRetry";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

function fixture() {
  vi.useFakeTimers();
  let handler: (event: L.TileErrorEvent) => void;
  const tile = document.createElement("img");
  document.body.append(tile);
  const layer = {
    on: vi.fn((_type, callback) => { handler = callback; }),
    off: vi.fn(),
    getTileUrl: vi.fn(() => "https://example.test/tile.png"),
  };
  const map = { hasLayer: vi.fn(() => true) };
  const cleanup = installResultTileRetry(layer as unknown as L.TileLayer, map as unknown as L.Map);
  return { tile, layer, map, cleanup, fail: () => handler({ tile, coords: { x: 1, y: 2, z: 3 } } as L.TileErrorEvent) };
}

it("retries a transient tile twice and stops after the budget", () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) {
    f.tile.src = "data:image/png,placeholder";
    f.fail();
    vi.runAllTimers();
    if (i < 2) expect(f.tile.src).toBe("https://example.test/tile.png");
    else expect(f.tile.src).toBe("data:image/png,placeholder");
  }
  f.cleanup();
});

it("cancels pending work when the layer is removed", () => {
  const f = fixture();
  f.fail();
  f.cleanup();
  vi.runAllTimers();
  expect(f.tile.getAttribute("src")).toBeNull();
  expect(f.layer.off).toHaveBeenCalledWith("tileerror", expect.any(Function));
});

it("does not request a tile that has left the map", () => {
  const f = fixture();
  f.fail();
  f.map.hasLayer.mockReturnValue(false);
  vi.runAllTimers();
  expect(f.tile.getAttribute("src")).toBeNull();
  f.cleanup();
});
