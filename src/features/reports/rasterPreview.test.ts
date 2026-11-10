import { afterEach, describe, expect, it, vi } from "vitest";
import type { AoiState } from "@/features/carbon/types";
import { renderRasterPreview } from "./rasterPreview";

const aoi: AoiState = { source: "coordinate", name: "AOI test", areaKm2: 10, bounds: null,
  feature: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[110,-7],[110.1,-7],[110.1,-6.9],[110,-6.9],[110,-7]]] } } };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("raster preview for PDF", () => {
  it("composes bounded result-tile requests and draws the AOI", async () => {
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), stroke: vi.fn(), fillText: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test");
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
    const request = vi.fn(async () => ({ ok: true, blob: async () => new Blob() })); vi.stubGlobal("fetch", request);
    const image = await renderRasterPreview("https://example.test/result/{z}/{x}/{y}.png", aoi);
    expect(image).toContain("data:image/png");
    expect(request.mock.calls.length).toBeGreaterThan(0);
    expect(request.mock.calls.length).toBeLessThanOrEqual(20);
    expect(context.drawImage).toHaveBeenCalledTimes(request.mock.calls.length);
    expect(context.stroke).toHaveBeenCalled();
  });

  it("rejects a failed tile rather than producing an incomplete map", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403 })));
    await expect(renderRasterPreview("https://example.test/{z}/{x}/{y}.png", aoi)).rejects.toThrow("403");
  });
});
