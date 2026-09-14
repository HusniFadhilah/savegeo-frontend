import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { loadSuperResolutionModel } from "./lib/modelLoader";
import type { ShaderQuality } from "./lib/gpuShaderModel";

type Props = {
  url: string;
  opacity?: number;
  pane?: string;
  maxNativeZoom?: number;
  maxZoom?: number;
  model?: "shader_x2" | "shader_x4";
  quality?: ShaderQuality;
  onStatus?: (status: "processing" | "active" | "fallback_original" | "error") => void;
};

const cache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 48;
const keyFor = (url: string, coords: L.Coords, model: string, quality: string) => `${url}|${coords.z}/${coords.x}/${coords.y}|${model}|${quality}`;

function template(url: string, coords: L.Coords) {
  const subdomains = (url.match(/\{s\}/g) ? ["a", "b", "c"] : [""]);
  const subdomain = subdomains[(coords.x + coords.y) % subdomains.length];
  return url.replace("{s}", subdomain).replace("{r}", "").replace("{z}", String(coords.z)).replace("{x}", String(coords.x)).replace("{y}", String(coords.y));
}

/** Leaflet overlay that enhances only visible imagery tiles in memory. */
export default function GpuEnhancedTileLayer({ url, opacity = 1, pane, maxNativeZoom, maxZoom, model = "shader_x2", quality = "medium", onStatus }: Props) {
  const map = useMap();
  useEffect(() => {
    let disposed = false;
    const modelPromise = loadSuperResolutionModel();
    const Layer = L.GridLayer.extend({
      createTile(coords: L.Coords, done: L.DoneCallback) {
        const tile = document.createElement("canvas"); tile.width = 256; tile.height = 256; tile.setAttribute("aria-hidden", "true");
        const key = keyFor(url, coords, model, quality); const cached = cache.get(key);
        if (cached) { tile.width = cached.width; tile.height = cached.height; tile.getContext("2d")?.drawImage(cached, 0, 0); done(undefined, tile); return tile; }
        const image = new Image(); image.crossOrigin = "anonymous";
        onStatus?.("processing");
        image.onload = async () => {
          if (disposed) return;
          const module = await modelPromise;
          if (disposed) return;
          const enhancer = module.create(tile);
          if (!enhancer || !enhancer.enhance(image, tile, quality)) { onStatus?.("fallback_original"); done(new Error("GPU enhancement unavailable"), tile); return; }
          cache.set(key, tile); while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
          onStatus?.("active"); done(undefined, tile);
        };
        image.onerror = () => { onStatus?.("error"); done(new Error("Imagery tile failed"), tile); };
        image.src = template(url, coords); return tile;
      },
    });
    const LayerConstructor = Layer as unknown as new (options?: L.GridLayerOptions) => L.GridLayer;
    const layer = new LayerConstructor({ tileSize: 256, opacity, pane, maxNativeZoom, maxZoom, zIndex: 402 });
    layer.addTo(map);
    return () => { disposed = true; map.removeLayer(layer); };
  }, [map, maxNativeZoom, maxZoom, model, onStatus, opacity, pane, quality, url]);
  return null;
}

export function clearGpuTileCache() { cache.clear(); }
