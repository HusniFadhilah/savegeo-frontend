import type { createGpuEnhancer } from "./gpuShaderModel";

/** Keep enhancement code out of the initial bundle until the user opts in. */
export async function loadSuperResolutionModel(): Promise<{ create: typeof createGpuEnhancer }> {
  const module = await import("./gpuShaderModel");
  return { create: module.createGpuEnhancer };
}
