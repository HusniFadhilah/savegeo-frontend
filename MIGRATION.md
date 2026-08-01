# Migration notes — `frontend-nextjs2` (Next.js) → `savegeo/frontend` (Vite/React/TS)

This is a from-scratch React rebuild, not a lift-and-shift: legacy HTML
string slices (`frontend-nextjs2/public/html/*.html`, injected via
`dangerouslySetInnerHTML`) and vanilla-JS/jQuery logic (`public/main.js`,
`public/admin-scripts.js`, `public/savegeo-chatbot.js`) were re-implemented
as typed React components, hooks, and services. `frontend-nextjs2` and the
original `frontend/` are left untouched as reference. `npm run build`
(tsc --noEmit + vite build) passes clean; zero `dangerouslySetInnerHTML`
usage anywhere in `src/`.

## Post-launch fix: API response-envelope mismatch (2026-08-01)

First real-backend smoke test surfaced empty province/model dropdowns and
carbon/vegetation/landcover/disaster analysis results that never populated
despite the backend returning 200s. Root cause: every feature's `api.ts` was
written assuming the legacy Flask convention of wrapping successful
responses in `{success: true, data: {...}}` (documented in the old
`frontend-nextjs2` migration notes). **`savegeo/backend` (the FastAPI
backend actually running) does not do this** - it returns the payload
directly on 200 and `{error: "..."}` on non-2xx (already handled correctly
by `apiClient`'s `ApiError`). So every `res.data`/`res.success` read was
silently `undefined`/`false` on success.

Fixed by verifying the real shape of each endpoint against
`savegeo/backend/app/api/routes/*.py` + `services/*.py` source and live
curl, then removing the `.data`/`.success` unwrapping at both the `api.ts`
level and every consuming component:

- `src/services/analysisService.ts` (regions - also fixed: provinces/cities/
  districts/villages come back as a flat `{name: code}` dict, not an array;
  islands are `{name, label}` not `{code, name}`) + `AoiRegionTab.tsx`
- `src/services/mapLayerService.ts` (basemaps/map-layers - also fixed: the
  basemap sort field is `order`, not `sort_order`)
- `src/hooks/useConfigStore.ts` (`GET /admin/config/public` - this one was
  silently falling back to hardcoded defaults *everywhere in the app*,
  never loading the real saved config)
- `src/features/carbon/api.ts` + `CarbonModule.tsx` + `CarbonParamsPanel.tsx`
  + `ExportPanel.tsx` (model list/info, analyze, GeoTIFF export)
- `src/features/vegetation/api.ts`, `src/features/landcover/api.ts` +
  `LandCoverParamsPanel.tsx` (analyze, dataset catalog)
- `src/features/disaster/api.ts` + `DisasterModule.tsx` (sources, BMKG
  alerts, DEM/slope, event-map - the latter two have a flat `success: true`
  field alongside their real data, not nested under `.data`, so this was an
  easy trap)
- `src/features/admin/api.ts` (type-accuracy cleanup only - admin was
  already correct, built without the bug from the start)

Confirmed already-correct (no bug): `src/features/lc-change/api.ts`,
`src/features/chatbot/api.ts`, `src/features/carbon/api.ts`'s
`listCompanies`/`getCompanyGeojson`. `src/types/api.ts` still defines an
unused `ApiEnvelope<T>` type - harmless dead code, nothing imports it.

**Lesson for any future endpoint added to this app**: never assume a
response envelope - read the actual FastAPI route/service return statement
(or curl the running backend) before writing the frontend caller.

## Architecture decisions

- **Vite + React 18 + TypeScript**, React Router for `/` and `/admin`,
  TanStack Query available, Zustand for light global state (auth, UI/loading,
  config, i18n).
- **No CDN scripts.** Leaflet/Leaflet.Draw, Bootstrap (CSS only), Chart.js,
  shpjs, `@tmcw/togeojson`, `html2canvas` are npm dependencies. jQuery,
  Select2, and Tom Select are dropped entirely — replaced with native React
  state/components (including a small dependency-free `SearchableSelect` in
  `features/admin/components/` standing in for Tom Select).
- **`dangerouslySetInnerHTML` is used nowhere in this app.** Chat messages
  render through a small `renderInlineMarkdown` helper that builds JSX
  directly (bold/italic/code/newlines) instead of an HTML string, so
  DOMPurify — while installed — ended up not being load-bearing anywhere;
  it's still available if a future feature genuinely needs sanitized HTML.
- **Bootstrap is CSS-only.** No Bootstrap JS bundle/Popper — dropdowns,
  accordions (Guide module), and modals that legacy drove with
  `data-bs-toggle` were reimplemented as small React state-driven components
  using the same Bootstrap classes for visual parity.
- **API contract preserved.** `src/services/apiClient.ts` +
  `src/config/env.ts` centralize `VITE_API_BASE_URL` (must include `/api`);
  every feature's `api.ts` calls the exact same backend paths/payloads the
  legacy app used.
- **Satellite is the default basemap everywhere**, forced in
  `src/config/basemaps.ts` / `src/services/mapLayerService.ts` regardless of
  what the `GET /api/basemaps` registry returns, with a static fallback pair
  if the registry is unreachable.

## Fully ported

- **Layout shell**: Navbar (status badge → system status modal, account
  menu), Sidebar (module nav, collapse, language switcher), LoadingOverlay,
  ConnectionStatus, LiveConfigPanel (admin-only quick config editor).
- **Map core**: MapView (Satellite default, auto invalidateSize on
  resize/tab switch), BasemapSwitcher, AoiDrawingTools (polygon/rectangle
  draw+edit+delete via Leaflet.Draw, plus an `externalGroupRef` extension so
  non-draw AOI sources — upload/region/company/coordinate — can push
  geometry onto the same editable layer), LayerOpacityControl, MapLegend,
  ResultTileLayer.
- **Static content**: About, Program Details, full step-by-step Guide
  (accordion reimplemented with React state instead of Bootstrap JS).
- **Carbon / Vegetation / Landcover** (one combined module, matching legacy
  structure — there was never a separate sidebar tab for vegetation or land
  cover): all 5 AOI methods (draw, file upload with client-side
  extension/20MB validation, Indonesia admin region chain + island + whole-
  Indonesia, coordinate+buffer, company boundary picker); Analysis Type
  selector (landcover / vegetation / carbon / combined) with per-type
  parameter panels; sequential run orchestration with per-stage error
  isolation and loading-overlay progress; tabbed result map with opacity
  slider + dynamic legend; metric cards, vegetation stats table, per-dataset
  landcover table + pie chart, carbon stats panel; GeoTIFF export modal,
  JSON stats download, Markdown report generation.
- **Land Cover Change**: control panel, year management (add/remove, min 2),
  dataset selector, transition-matrix table, net-change/time-series charts
  (Chart.js), before/after maps with real backend change-map integration,
  JSON export.
- **Disaster Mapping**: official-source status panel, BMKG alerts (rendered
  as plain React text, never HTML), DEM/slope analysis, before/after
  event-map detection with AOI, legend, metric summary.
- **Chatbot**: session management (list/open/rename/delete/new/search),
  send/receive with image+file attachments, screenshot capture
  (`html2canvas`, dynamically imported/code-split), SHP→GeoJSON (server
  round-trip), KML→GeoJSON (`@tmcw/togeojson`), GeoJSON/JSON upload,
  AOI-offer/confirmation/choice/guide-step cards, action-history replay,
  rate-limit + slow-response handling, quick-action chips, bilingual UI text.
- **Admin**: login, dashboard overview, GEE credential upload/activate/
  delete (validated), ArcGIS status, ML model upload/list/activate/
  set-default/delete (validated), full system config editor (all
  categories, not just the 6-key Live Config panel), AI provider config with
  write-only secret fields + OpenRouter model picker, Key Pool backup-key
  management, admin user info + password change, company boundary CRUD +
  GeoJSON upload/paste (validated) + OSM/GFW import. Every form has
  loading/error/success states.

## Known deviations from legacy (by design)

- **i18n**: only chrome-level strings (nav/sidebar/status/login) are in
  `src/i18n/translations.ts`. Legacy's `I18N_EXACT` + `LULC_CLASS_
  TRANSLATIONS` dictionaries (hundreds of analysis-result strings) were not
  transcribed — analysis modules default to Indonesian text (legacy's
  default language); LULC class names in results are shown untranslated
  (raw/underscore-replaced). The chatbot has its own separate id/en toggle
  via `useI18nStore` for its own UI text. Full EN parity for analysis-result
  strings is a follow-up.
- **Cross-module AOI is not shared.** Legacy used one global `currentAOI`
  set by the Carbon module and read by LC-Change/Disaster/chatbot. This app
  has no `useAoiStore` yet, so Carbon, LC-Change, and Disaster each draw
  their own AOI independently — redrawing is required when switching
  modules. Flagged independently by three of the six migration passes as
  the top recommended follow-up.
- **LC-Change charts**: legacy used Plotly (Sankey, heatmap, bar,
  stacked-area); only Chart.js is installed here. The transition matrix is a
  color-scaled HTML table instead of a Plotly heatmap; net change/time
  series use Chart.js Bar/Line. The Sankey diagram has no equivalent.
- **Admin Tom Select replacement**: a ~200-line dependency-free
  `SearchableSelect` component (search filter, grouping, keyboard nav)
  instead of an npm package or CDN script.
- **Chatbot map-control actions currently no-op safely.** The action
  executor still probes `window.switchModule`, `window.currentAOI`,
  `window.map`, DOM ids like `yearSlider`, etc. — none of these globals are
  exposed by any module yet (all modules use local React state, not
  `window`). Every probe is a graceful `typeof x === 'function'`/existence
  check, so nothing breaks; the chatbot just can't drive the map or AOI yet.
  Once a shared AOI/map store exists, wiring it up lights these actions up
  with no chatbot-side changes needed.

## Known follow-ups / pending

1. **Shared `useAoiStore`** (zustand) so one drawn/imported AOI is usable
   across Carbon, LC-Change, Disaster, and the chatbot — the single most
   impactful follow-up, recommended independently by three migration passes.
2. **Carbon Delta (year-over-year) analysis + charts** — deferred.
3. **Land Cover Transition (Sankey/heatmap/net-change) in the Carbon
   module** — deferred; Plotly was intentionally not added for this.
4. **Executive Summary DOCX export** — deferred (JSON + Markdown export
   are implemented).
5. Admin-boundary child-level browsing (province→city→district drill-down on
   the AOI map) — was already a deferred gap in `frontend-nextjs2`, still
   not ported here.
6. Chatbot's geocoding-driven AOI actions and map-control actions — degrade
   gracefully (see deviations above), will light up once #1 lands.
7. Full i18n parity for analysis-result strings (see deviations above).
8. **Backend gap, not fixable from this repo**: `savegeo/backend/README.md`
   documents that the company-boundary admin CRUD/import endpoints, the
   OpenRouter model-list proxy, and the key-pool status endpoint were
   intentionally left out of the new FastAPI backend's contract. The admin
   UI for all three is fully built and will work as soon as those routes
   exist on whichever backend is running (legacy Flask `backend/` already
   has them; new `savegeo/backend/` does not yet).

## Running dev / build

```bash
cd savegeo/frontend
npm install       # npm.cmd on Windows PowerShell if execution policy blocks npm
npm run dev        # dev server, port 5501
npm run build      # tsc --noEmit + vite build
```

Backend must be reachable at `VITE_API_BASE_URL` (`.env`/`.env.local`,
default `http://localhost:8086/api`) for API-dependent features to work at
runtime; the app degrades gracefully (fallback basemaps, offline status,
per-panel error states) without one.
