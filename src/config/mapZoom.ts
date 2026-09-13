export const HIGH_DETAIL_MAX_ZOOM = 22;
export const RESULT_TILE_MAX_NATIVE_ZOOM = 18;

/** 256px Web Mercator tiles: choose the first zoom sampling at or below the
 * source GSD. Interpolation never increases the source's native resolution. */
export function nativeZoomForResolution(resolutionM?: number | null): number {
  if (!resolutionM || !Number.isFinite(resolutionM) || resolutionM <= 0) return RESULT_TILE_MAX_NATIVE_ZOOM;
  return Math.max(0, Math.min(HIGH_DETAIL_MAX_ZOOM, Math.ceil(Math.log2(156543.03392 / resolutionM))));
}
