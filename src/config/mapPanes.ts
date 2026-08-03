/**
 * GEE result tile layers (carbon/vegetation/landcover/disaster/lc-change)
 * were plain Leaflet TileLayers sharing the default `tilePane` (z-index 200)
 * with the basemap. Leaflet stacks layers within a pane by DOM insertion
 * order, so switching basemaps via BasemapSwitcher (which adds the new
 * basemap tile layer AFTER the result layer already exists) silently
 * covered every result overlay - the analysis state/legend stayed intact,
 * only the visible raster disappeared. Giving result layers their own pane
 * above `tilePane` (but below the default `overlayPane` z=400, so AOI
 * polygons/GeoJSON borders still render on top) fixes this regardless of
 * add/remove order. Created once per map in MapView.tsx.
 */
export const RESULT_PANE = "gee-result-pane";
export const RESULT_PANE_Z_INDEX = 350;
