import { describe, expect, it } from "vitest";
import { detectGpuCapabilities, recommendedEnhancementScale } from "./gpuCapabilities";

describe("GPU capability detection", () => {
  it("does not fail when the browser exposes no WebGL context", () => {
    const capabilities = detectGpuCapabilities();
    expect(capabilities.backend).toBe("original");
    expect(recommendedEnhancementScale(capabilities)).toBe(1);
  });
});
