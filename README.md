# SAVEGEO Frontend (React + Vite)

Clean React 18 / TypeScript / Vite rebuild of the SAVEGEO geospatial platform
frontend, replacing the temporary Next.js migration at `../../frontend-nextjs2`
and the original static app at `../../frontend`. This is now the primary
frontend for the SAVEGEO/GEOMOKA platform.

## Install & run

```bash
npm install
npm run dev      # dev server on http://localhost:5501
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
npm run lint      # eslint
npm run test      # vitest
```

On Windows PowerShell, if `npm` is blocked by execution policy, use `npm.cmd`.

The app expects a backend (legacy Flask `backend/` or new FastAPI
`savegeo/backend/`, same API contract) reachable at `VITE_API_BASE_URL`.
Without a backend running, the dashboard still loads: basemaps fall back to
the static Satellite/Roads pair, the connection status badge shows
"Backend Offline", and API-dependent panels show their own error/empty states
instead of crashing.

## Environment variables

Copy `.env.example` to `.env.local` and adjust:

| Var | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (**must include** the `/api` suffix) | `http://localhost:8086/api` |
| `VITE_APP_NAME` | Display name | `SAVEGEO` |
| `VITE_APP_ENV` | Environment label | `development` |

Only `VITE_`-prefixed, non-secret values belong here — Vite inlines them into
the client bundle at build time. Never put API keys, service-role keys, or
JWT secrets in this app; those live in the backend only.

## Folder structure

```
src/
  main.tsx, App.tsx           entry point, providers (React Query, Router)
  routes/AppRoutes.tsx        "/" -> DashboardPage, "/admin" -> AdminPage
  pages/                      DashboardPage, AdminPage, LoginPage
  components/layout/          Navbar, Sidebar, LoadingOverlay, ConnectionStatus, LiveConfigPanel
  components/map/             MapView, BasemapSwitcher, AoiDrawingTools, LayerOpacityControl, MapLegend
  components/modules/         static content modules (About, Details, Guide)
  components/modals/          SystemStatusModal
  features/carbon/            carbon analysis (dataset/model/AOI/results/report)
  features/vegetation/        vegetation index catalog + comparison (used inside CarbonModule)
  features/landcover/         land cover classes/chart/tiles (used inside CarbonModule)
  features/lc-change/         land cover change (transition matrix, before/after maps)
  features/disaster/          disaster mapping (BMKG, DEM/slope, event map)
  features/chatbot/           SaveGeo chatbot widget
  features/admin/             admin dashboard (GEE creds, ArcGIS, AI config, models, companies)
  services/                   apiClient, authService, mapLayerService, analysisService
  config/                     env.ts, basemaps.ts
  types/                      api.ts, map.ts
  hooks/                      zustand stores (auth, ui, config, i18n) + utility hooks
  i18n/                       chrome-level ID/EN translation dictionary
  styles/                     legacy-base.css (ported from public/style.css) + app.css (new components)
```

## Modules

Dashboard (`/`): Navbar, Sidebar, Connection status, Live Config panel
(admin-only), and one active module at a time — Carbon Stock Analysis
(includes Vegetation Index and Land Cover analysis types, matching the
legacy app's single combined module), Land Cover Change, Disaster Mapping,
Guide, About, Program Details. The SaveGeo chatbot widget is mounted globally.

Admin (`/admin`): login gate, then dashboard overview, GEE credential
management, ArcGIS status, AI provider config (with secret masking), model
registry (upload/list/activate/set-default/delete), company boundary CRUD +
OSM/GFW import, config editor, admin password change.

## Map / basemap contract

- Default basemap is **Satellite** (Esri World Imagery) everywhere, never
  Roads. See `src/config/basemaps.ts` (`FALLBACK_BASEMAPS`) and
  `src/services/mapLayerService.ts` (`fetchBasemaps`, forces a Satellite
  default even if the backend registry doesn't flag one).
- `GET /api/basemaps` is the live registry; on failure/empty response the
  frontend falls back to the static Satellite/Roads pair — the default is
  never silently demoted to Roads.
- Roads/OpenStreetMap remains available as a switcher option.

## Backend endpoints used (contract preserved from the legacy app)

Health: `GET /health`. Regions: `GET /regions/provinces|cities|districts|
villages|islands|indonesia/geometry|geometry`. Basemaps/layers:
`GET /basemaps`, `GET /map-layers`. Config: `GET /admin/config/public`,
`PUT /admin/config` (auth). Auth: `POST /admin/auth/login`. Admin domains
(GEE credentials, ArcGIS, AI config, models, companies, chat) — see each
feature's local `api.ts` for the exact paths it calls; none of them were
renamed from the legacy contract.

## Security notes

- No secrets in this repo or bundle — only `VITE_`-prefixed non-secret env
  vars. `.env`/`.env.local` are gitignored.
- Admin bearer token is stored in `sessionStorage` (not `localStorage`) via
  `src/services/authService.ts` — cleared on tab close and on any `401`
  response (`apiClient`'s unauthorized handler triggers logout).
- `dangerouslySetInnerHTML` is avoided project-wide. The one narrow,
  documented exception is chat content that must render backend-controlled
  HTML, which goes through `DOMPurify.sanitize()` first — see
  `src/features/chatbot/`.
- File uploads (AOI GeoJSON/KML/GPX/Shapefile, GEE credential JSON, model
  files, company boundary GeoJSON) are validated client-side for extension
  and size before being sent — this is a UX/defense-in-depth layer, the
  backend is still the authority on rejecting bad input.
- `apiClient` centralizes error handling, request timeouts, and auth header
  attachment — feature code shouldn't hand-roll `fetch()`.

## Known gaps / follow-ups

See `MIGRATION.md` in this folder for the detailed, up-to-date list of what's
fully ported vs. still a placeholder.
