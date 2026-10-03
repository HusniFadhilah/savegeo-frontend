import { useEffect, useState } from "react";
import { fetchBasemaps } from "@/services/mapLayerService";
import { withOptionalGoogleSatelliteBasemap } from "@/services/googleMapsTiles";
import { FALLBACK_BASEMAPS, withNasaGibsBasemap, withOptionalMapboxBasemap } from "@/config/basemaps";
import type { BasemapDefinition } from "@/types/map";

/** Shared across every map instance so the registry is only fetched once. */
let cache: BasemapDefinition[] | null = null;
let inflight: Promise<BasemapDefinition[]> | null = null;

async function load(): Promise<BasemapDefinition[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      let configured: BasemapDefinition[];
      try {
        const result = await fetchBasemaps();
        const byId = new Map(FALLBACK_BASEMAPS.map((b) => [b.id, b]));
        (result ?? []).filter((b) => b.enabled !== false).forEach((b) => byId.set(b.id, { ...byId.get(b.id), ...b } as BasemapDefinition));
        configured = Array.from(byId.values()).filter((b) => b.enabled !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      } catch {
        configured = FALLBACK_BASEMAPS;
      }
      cache = await withOptionalGoogleSatelliteBasemap(withOptionalMapboxBasemap(withNasaGibsBasemap(configured)));
      return cache;
    })();
  }
  return inflight;
}

export function useBasemaps() {
  const [basemaps, setBasemaps] = useState<BasemapDefinition[]>(cache ?? withOptionalMapboxBasemap(FALLBACK_BASEMAPS));
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
