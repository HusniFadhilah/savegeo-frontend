import { useCallback, useEffect, useState } from "react";
import { detectGpuCapabilities, recommendedEnhancementScale, type GpuCapabilities, type GpuBackend } from "../lib/gpuCapabilities";
import { loadSuperResolutionModel } from "../lib/modelLoader";
import type { ShaderQuality } from "../lib/gpuShaderModel";

export type SuperResolutionStatus = "idle" | "checking_gpu" | "loading_model" | "processing" | "active" | "fallback_original" | "error";
export type SuperResolutionModel = "shader_x2" | "shader_x4";

export function useGpuSuperResolution(enabled: boolean) {
  const [status, setStatus] = useState<SuperResolutionStatus>("idle");
  const [capabilities, setCapabilities] = useState<GpuCapabilities | null>(null);
  const [model, setModel] = useState<SuperResolutionModel>("shader_x2");
  const [quality, setQuality] = useState<ShaderQuality>("medium");
  const [backend, setBackend] = useState<GpuBackend>("original");
  const [cacheVersion, setCacheVersion] = useState(0);

  useEffect(() => {
    if (!enabled) { setStatus("idle"); return; }
    setStatus("checking_gpu");
    const next = detectGpuCapabilities(); setCapabilities(next);
    // The bundled enhancer is a WebGL2 shader; WebGPU is still surfaced as a
    // capability so a future ONNX/WebGPU model can be selected without API changes.
    const runtimeBackend: GpuBackend = next.webgl2 ? "webgl2" : "original";
    setBackend(runtimeBackend);
    if (runtimeBackend === "original") { setStatus("fallback_original"); return; }
    if (next.isMobile && model === "shader_x4") setModel("shader_x2");
    setStatus("loading_model");
    loadSuperResolutionModel().then(() => setStatus("active")).catch(() => { setStatus("error"); setBackend("original"); });
  }, [enabled, model]);

  const clearCache = useCallback(() => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("savegeo:gpu-cache-clear"));
    setCacheVersion((value) => value + 1);
  }, []);
  return { status, capabilities, backend, model, setModel, quality, setQuality, clearCache, cacheVersion, recommendedScale: capabilities ? recommendedEnhancementScale(capabilities) : 2 };
}
