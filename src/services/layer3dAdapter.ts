import type { Layer3DDefinition } from "@/workflow/types";

/** Small, Cesium-neutral contract used by the workflow UI and the existing Cesium bridge. */
export function normalizeLayer3D(layer: Layer3DDefinition): Layer3DDefinition {
  return { ...layer, visible: layer.visible !== false, opacity: Math.max(0, Math.min(1, layer.opacity ?? 1)) };
}

export function layersAtTime(layers: Layer3DDefinition[], activeTime: string): Layer3DDefinition[] {
  return layers.map(normalizeLayer3D).filter((layer) => {
    if (!layer.time) return true;
    return (!layer.time.start || activeTime >= layer.time.start) && (!layer.time.end || activeTime <= layer.time.end);
  });
}

export function createExtrusionStyle(heightProperty = "height"): Record<string, unknown> {
  return { clampToGround: false, extrudedHeight: { property: heightProperty }, fill: "#36a269", fillAlpha: 0.55, outline: true };
}
