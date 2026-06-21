# Frontend Agent Context

Dokumen ini adalah entry point untuk agent yang akan melanjutkan pengembangan frontend Geomoka/SAVEGEO.

## Scope Frontend

Frontend utama untuk request ini adalah folder `frontend`. Aplikasi memakai Vite dan sebagian besar UI/logic masih berada dalam satu file besar `index.html`. Ada juga `frontend-nextjs2`, tetapi jangan sentuh kecuali task secara eksplisit menyebut Next.js.

## File Penting

- `index.html`: UI utama, modul peta, kontrol analisis, API calls, rendering hasil, export report.
- `admin.html`: admin UI untuk credential/model/config.
- `public/config-manager.js`: default config frontend dan binding config runtime.
- `public/custom-scripts.js`: script tambahan UI.
- `public/style.css`: styling utama tambahan.
- `package.json`: script Vite.

## Bagian Karbon Di index.html

- Selector dataset: cari `carbonReferenceDataset`.
- Payload analisis: cari `runCarbonAnalysis()`.
- Display statistik karbon: cari `displayCarbonStats()`.
- Deskripsi dataset: cari `updateDatasetDescription()`.
- Visibility year selector: cari `updateYearSelectorVisibility()`.
- Report markdown: cari `analysisResults.carbon` dan `Reference Dataset`.

## Dokumen Lanjutan

- `carbon-ui-contract.md`: field frontend yang harus cocok dengan backend.
- `adding-carbon-dataset.md`: checklist perubahan UI saat menambah dataset baru.
- `development-notes.md`: catatan praktis untuk menjaga UI tetap stabil.

## Bagian LULC / Land Cover Di index.html

- Dataset dropdown: `loadLandCoverDatasetOptions()` — auto-populate dari `GET /api/landcover/datasets`.
- Transition dropdown: diisi dari dataset yang `supports_transition !== false`.
- Results stored: `analysisResults.landcover[dataset_key]`.
- Legend: `updateLegend(layerName)` — membaca `analysisResults.landcover[layerName].classes`.
- Table/chart: `renderLandCoverTableAndChart(key, label)` — generic, tidak hardcode key.
- Layer tile: `switchResultLayer(layerName)` → `analysisResults.landcover[layerName].tile_url`.

### Menambah LULC Dataset Baru (untuk agent)

1. Tambah entry di `backend/landcover_dataset_registry.py`:
   - `LAND_COVER_LEGENDS[key]`, `LAND_COVER_VIS[key]`, `LAND_COVER_NATIVE_SCALE[key]`, `LAND_COVER_DATASET_OPTIONS[key]`.
2. Tambah branch di `get_landcover_image()` di `backend/app.py`.
3. Jika `provider_type = 'cloud_geotiff'`: tambah helper URI resolver di registry, impor di app.py.
4. Jika `supports_transition = False`: backend sudah menolak di kedua endpoint transition.
5. Frontend tidak perlu diubah kecuali ada UI behavior yang benar-benar provider-specific.

### Provider Types

| `provider_type` | Tag di dropdown | Loading |
|---|---|---|
| `gee_official` | (tidak ada tag) | GEE ImageCollection/Image |
| `gee_community_catalog` | (tidak ada tag) | GEE `projects/sat-io/...` |
| `arcgis_living_atlas` | `[ArcGIS]` | ArcGIS ImageServer computeHistograms |
| `cloud_geotiff` | `[Cloud GeoTIFF]` | `ee.Image.loadGeoTIFF(gs://...)` |
| `external_raster` | `[Cloud GeoTIFF]` | custom loader |
| `open_lulc_api` | `[Cloud GeoTIFF]` | HTTP query endpoint |

## Quick Start Untuk Agent

Jika backend menambah dataset karbon baru:

1. Baca `adding-carbon-dataset.md`.
2. Tambahkan option dengan key backend yang sama persis.
3. Tambahkan deskripsi dan aturan visibility tahun.
4. Pastikan tampilan statistik mengambil metadata dari `carbon_reference`.
5. Uji analisis karbon dengan AOI kecil.

Jika backend menambah dataset LULC baru:

1. Cukup tambah di registry dan `get_landcover_image()` di backend (lihat panduan di atas).
2. Frontend populate otomatis dari API.
3. Tidak ada perubahan UI yang diperlukan untuk dataset biasa.

Jika response backend berubah:

1. Baca `carbon-ui-contract.md`.
2. Jaga fallback untuk struktur lama selama memungkinkan.
3. Update report markdown dan map layer bersama-sama.
