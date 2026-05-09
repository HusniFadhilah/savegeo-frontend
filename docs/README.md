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

## Quick Start Untuk Agent

Jika backend menambah dataset baru:

1. Baca `adding-carbon-dataset.md`.
2. Tambahkan option dengan key backend yang sama persis.
3. Tambahkan deskripsi dan aturan visibility tahun.
4. Pastikan tampilan statistik mengambil metadata dari `carbon_reference`.
5. Uji analisis karbon dengan AOI kecil.

Jika response backend berubah:

1. Baca `carbon-ui-contract.md`.
2. Jaga fallback untuk struktur lama selama memungkinkan.
3. Update report markdown dan map layer bersama-sama.
