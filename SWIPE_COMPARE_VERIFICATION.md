# SaveGeo swipe comparison repair

## Root causes

- Leaflet's translated `mapPane` does not have viewport dimensions. Its child panes used `100%` width/height and percentage insets, producing an empty or incorrect clipping rectangle.
- AOI coordinates were in layer space while divider/viewport coordinates assumed container space. Panning made the cut drift relative to the handle.
- An empty AOI intersection returned `clip-path: none`, exposing the entire scene at endpoints or outside the AOI. Polygon holes were ignored.
- The before tile mounted without waiting for its custom pane. There was no tile readiness/error gate or keyboard control.
- Imagery comparisons omitted shared AOI geometry/bounds and could accept stale scene responses after input changes.

## Changes

`src/components/map/SwipeCompareMap.tsx` retains one map and two persistent tile layers in distinct panes. Both panes have explicit viewport pixel dimensions. AOI rings are projected into container coordinates, intersected with each side of the divider, then translated back into Leaflet layer coordinates. An even-odd path preserves holes and multipolygons; an empty path hides an empty intersection. Both sides are clipped so opacity reveals the basemap rather than blending the other comparison layer underneath.

Pane overflow is intentionally visible: Leaflet translates the parent mapPane during pan, so the pane's own box is not the visible viewport. The computed clip path supplies the actual viewport boundary. `overflow: hidden` would cut off correctly positioned tiles after a pan.

Both tiles wait for pane creation. Readiness follows tile loading/error events and resets on source/AOI changes. Missing URLs show the remaining layer across the AOI; failed loads expose a retry button. Pointer/mouse window fallbacks, pointer capture/cancellation, touch-compatible pointer events, keyboard arrows/Home/End, and temporary pan locking protect slider interaction. Pointer updates are limited to animation frames; dragging does not remount maps/tiles or call APIs.

Caller changes:

- `src/features/disaster/components/SatelliteViewer.tsx`: preserve the map across pre/post changes and refit when the actual AOI geometry changes.
- `src/features/lc-change/components/BeforeAfterMaps.tsx`: retain normal/changed/destination URL mapping, label each mode correctly, and draw the AOI boundary above comparison imagery.
- `src/features/carbon/components/ResultsMapPanel.tsx`: update comparison tabs when results change, update the AOI boundary, and fit the current AOI in the same map.
- `src/features/imagery/ImageryModule.tsx`: pass exact AOI/bounds, use per-scene native zoom, invalidate stale comparison requests, and display the boundary above imagery.
- `.gitignore`: exclude generated browser evidence under `test-results/`.
- `tests/browser/swipe.html`, `swipe-fixture.tsx`, `swipe-check.cjs`: reproducible browser integration and pixel regression tests.
- Backend repository: `tests/test_scene_swipe_aoi.py` asserts that both scene images are clipped with the same geometry before tile URL creation. Existing GEE land-cover/carbon/scene clipping did not require changes.

## Validation

- `npm run build`: passed; no TypeScript errors. Existing bundle-size/dynamic-import warnings remain.
- `npm test`: passed (7 tests on the working feature branch).
- Targeted ESLint: no errors; existing unused-variable warnings in imagery/land-cover remain.
- Backend `python -m compileall -q app`: passed.
- Backend imagery/carbon tests: 9 passed, 8 subtests passed; new scene AOI regression: 1 passed.
- Chromium: 20 combinations (shared component plus disaster, land-cover, carbon, imagery; desktop/mobile; vertical/horizontal). Screenshots are decoded and red/blue pixel counts asserted at 0/50/100 percent. Real mouse and touch input, keyboard input, unchanged map transform, retained tile elements, and unchanged tile request counts are asserted.
- Additional checks cover AOI holes, pan/resize without AOI clipping, layer/AOI replacement, missing/failed tile URLs, opacity, all three land-cover modes, split view, disaster pre/post-only, and imagery scene reload after AOI changes.

Run Vite, then with Playwright available:

```sh
npm run dev -- --host 127.0.0.1
node tests/browser/swipe-check.cjs
```

`PLAYWRIGHT_MODULE` can point to an existing Playwright installation. `SWIPE_TEST_URL` selects the Vite URL; `SWIPE_MODULES` optionally selects comma-separated fixture modules. PNG evidence and pixel counts are written to `test-results/swipe/`.

## Live-data limits

The actual application routes were opened in the browser. Protected routes require login in this environment. The disaster event viewer is routed at `/pemetaan-bencana/:eventId`; `/disaster` is not registered in this checkout.

The pixel tests use production React/Leaflet components with deterministic synthetic imagery and controlled API responses. They validate actual rendered pixels and scene-request AOI payloads, but do not establish availability or content differences of authenticated live GEE/local disaster datasets. No claim of authenticated production end-to-end verification is made.
