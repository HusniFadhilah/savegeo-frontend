import type L from "leaflet";

/** Retry transient tile failures while the original layer and image are mounted. */
export function installResultTileRetry(layer: L.TileLayer, map: L.Map) {
  const attempts = new WeakMap<HTMLElement, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const onError = (event: L.TileErrorEvent) => {
    const tile = event.tile as HTMLImageElement;
    const attempt = attempts.get(tile) ?? 0;
    if (attempt >= 2) return;
    attempts.set(tile, attempt + 1);
    const url = layer.getTileUrl(event.coords);
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (map.hasLayer(layer) && tile.isConnected) tile.src = url;
    }, 1000 * 2 ** attempt);
    timers.add(timer);
  };
  layer.on("tileerror", onError);
  return () => {
    layer.off("tileerror", onError);
    timers.forEach(clearTimeout);
    timers.clear();
  };
}
