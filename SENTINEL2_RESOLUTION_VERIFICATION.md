# Sentinel-2 resolution verification

## Findings and changes

- Scene display previously defaulted to bicubic 4x, assigned an artificial finer grid, and divided native resolution when choosing Leaflet zoom. Interpolation now defaults off; optional bicubic changes display only, with unchanged source resolution and analytical values.
- Shared native zoom is calculated from actual source/asset resolution: 10 m -> 14, 20 m -> 13, 60 m -> 12. Each comparison side retains its own cap while sharing one geographical map. Above-native zoom explicitly reports enlargement without added detail.
- RGB selects B4/B3/B2 before final tile generation. Sentinel-2 uses the harmonized catalog; NDVI uses B8/B4. Cloud masks precede composites. Scene cloud masking defaults on in the UI and remains explicitly selectable.
- Bandwise medians retain each band's source projection without forced reprojection. Mixed-projection composites otherwise have a generic default projection; this alone does not prove that Earth Engine rendered previous map tiles at one-degree resolution, because map evaluation is demand driven.
- Vegetation statistics distinguish native and analysis scale; indices using Sentinel-2 20 m bands are not reduced at a finer analytical scale.
- STAC thumbnail/preview assets are excluded; unavailable selected full-resolution assets raise an explicit error. The COG renderer retains rio-tiler XYZ overview selection and 256-pixel tiles.
- Scene responses include dataset, resolution/native scale, bands, cloud-mask method and scene count. Existing acquisition dates/composite date ranges and counts remain available. Development map DOM exposes resolution, native zoom and tile URL; signed URLs are not stored in this report.

## Changed files

Frontend: `src/config/mapZoom.ts`, its unit test, `src/components/map/{RasterResolutionNotice,ResultTileLayer,SwipeCompareMap}.tsx`, `src/features/disaster/components/SatelliteViewer.tsx`, `src/features/imagery/ImageryModule.tsx`, `src/features/carbon/components/ResultsMapPanel.tsx`, `src/features/lc-change/components/BeforeAfterMaps.tsx`, vegetation/landcover types, and browser fixtures/checks under `tests/browser/`.

Backend: `app/services/{imagery_resolution,imagery_service,vegetation_service,disaster_service}.py`, `tests/test_imagery_resolution.py`, `scripts/verify_sentinel_resolution.py`.

## Validation

- Working frontend production build and 9 unit tests passed. Targeted lint has no errors (3 existing unused-variable warnings); existing bundle warnings remain.
- Backend compile passed; targeted suite: 16 tests and 8 subtests passed. Includes final masked/selected/clipped GEE tile chain, band grids, interpolation, high-zoom COG rendering and thumbnail rejection.
- Chromium fixture matrix covers desktop/mobile and both slider orientations across shared, disaster, land-cover, carbon, imagery and resolution fixtures. Checks include rendered pixel differences, independent 10/20 m native zoom, zoom 17 enlargement labels, opacity, AOI changes, mode switching, stable map transforms and no slider-triggered tile reloads.

## Real GEE imagery, 14 September 2026

Live verification succeeded after retrying a network timeout. Small Bali AOI: longitude 115.19-115.25, latitude -8.68 to -8.62.

| Period | Candidate scenes | Selected scene | B4 / B8 / B11 scale |
| --- | ---: | --- | --- |
| June-August 2024 | 32 | 20240615T021611_20240615T023712_T50LKR | 10 / 10 / 20 m |
| June-August 2025 | 34 | 20250804T021529_20250804T023436_T50LKR | 10 / 10 / 20 m |

The script checks composite band projections on GEE, then downloads 15 native XYZ tiles per selected scene at zoom 14 from the production scene service. RGB tiles are 256x256, cloud-masked and clipped to the AOI. Candidate counts above describe collections; displayed imagery is one selected scene per period.

`live-resolution-check.cjs` passed with those real cached tiles: fixed-location screenshot pixels differ between scenes in both orientations, the map transform stays constant and dragging triggers no additional imagery requests. Screenshot inspection confirms native raster detail and cloud-mask gaps; these gaps are transparent, not low-resolution fallback. Evidence is under ignored `test-results/live-resolution/`.

Protected production application routes still require login; these checks exercise production components in fixtures plus the real GEE scene service, not an authenticated deployed end-to-end session. No claim is made that Sentinel-2 resolves objects smaller than its native pixels or that all third-party COGs were independently inspected.

Reproduce: run `python scripts/verify_sentinel_resolution.py` from backend with configured GEE credentials, start frontend Vite, then run `node tests/browser/live-resolution-check.cjs` and `node tests/browser/swipe-check.cjs`. Set `PLAYWRIGHT_MODULE` and `SWIPE_TEST_URL` as needed.

## References

- [Official Sentinel-2 SR harmonized band catalog](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED)
- [Earth Engine projections and composite defaults](https://developers.google.com/earth-engine/guides/projections)
