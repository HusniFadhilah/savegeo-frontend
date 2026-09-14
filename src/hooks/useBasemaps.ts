import { useEffect, useState } from "react";
import { fetchBasemaps } from "@/services/mapLayerService";
import { FALLBACK_BASEMAPS } from "@/config/basemaps";
import type { BasemapDefinition } from "@/types/map";

/** Shared across every map instance so the registry is only fetched once. */
let cache: BasemapDefinition[] | null = null;
let inflight: Promise<BasemapDefinition[]> | null = null;

async function load(): Promise<BasemapDefinition[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetchBasemaps().then((result) => {
      const configured = (result ?? []).filter((b) => b.enabled !== false);
      const byId = new Map(FALLBACK_BASEMAPS.map((b) => [b.id, b]));
      configured.forEach((b) => byId.set(b.id, { ...byId.get(b.id), ...b } as BasemapDefinition));
      cache = Array.from(byId.values()).filter((b) => b.enabled !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      return cache!;
    }).catch(() => { cache = FALLBACK_BASEMAPS; return cache; });
  }
  return inflight;
}

export function useBasemaps() {
  const [basemaps, setBasemaps] = useState<BasemapDefinition[]>(cache ?? FALLBACK_BASEMAPS);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    if (!cache) {
      load().then((result) => {
        if (!cancelled) {
          setBasemaps(result);
          setLoading(false);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return { basemaps, loading };
}
