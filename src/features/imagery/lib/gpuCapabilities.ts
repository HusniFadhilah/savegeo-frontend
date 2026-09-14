export type GpuBackend = "webgpu" | "webgl2" | "cpu" | "original";

export interface GpuCapabilities {
  webgpu: boolean;
  webgl2: boolean;
  backend: GpuBackend;
  deviceMemory?: number;
  hardwareConcurrency: number;
  isMobile: boolean;
  maxTextureSize?: number;
}

/** Detect capability without requesting a GPU permission or creating a persistent context. */
export function detectGpuCapabilities(): GpuCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { webgpu: false, webgl2: false, backend: "original", hardwareConcurrency: 1, isMobile: false };
  }
  if (/jsdom/i.test(navigator.userAgent)) {
    return { webgpu: false, webgl2: false, backend: "original", hardwareConcurrency: 1, isMobile: false };
  }
  const nav = navigator as Navigator & { gpu?: unknown; deviceMemory?: number };
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  let webgl2 = false;
  let maxTextureSize: number | undefined;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    webgl2 = Boolean(context);
    if (context) maxTextureSize = context.getParameter(context.MAX_TEXTURE_SIZE) as number;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  const webgpu = Boolean(nav.gpu);
  const backend: GpuBackend = webgpu ? "webgpu" : webgl2 ? "webgl2" : "original";
  return {
    webgpu,
    webgl2,
    backend,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    isMobile,
    maxTextureSize,
  };
}

export function recommendedEnhancementScale(capabilities: GpuCapabilities): 1 | 2 | 4 {
  if (capabilities.backend === "original") return 1;
  if (capabilities.isMobile || (capabilities.deviceMemory ?? 8) <= 2 || capabilities.hardwareConcurrency <= 2) return 2;
  return capabilities.webgpu ? 4 : 2;
}
