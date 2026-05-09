# Frontend Development Notes

## Project Shape

- `frontend/index.html` adalah file besar berisi HTML, CSS class usage, dan JavaScript.
- Gunakan pencarian teks sebelum edit karena banyak fungsi saling bergantung.
- Hindari refactor besar kecuali task memang meminta pemecahan file.

## Running

Script dari `frontend/package.json`:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run serve`

Repo juga memiliki `node_modules`, jadi build/dev biasanya bisa dijalankan tanpa install ulang.

## Carbon UI Risks

- Response backend tidak selalu punya wrapper `success`; cek `apiClient` sebelum mengubah handling response.
- `displayCarbonStats()` masih punya fallback lama untuk `model_info.reference_dataset_info`.
- Dataset dropdown dan deskripsi harus sinkron dengan backend `get_dataset_info`.
- AOI besar dapat membuat request lama; UI progress hanya estimasi langkah, bukan progress GEE aktual.

## Suggested Small Improvements

- Jadikan `carbon_reference` sumber utama untuk dataset display.
- Buat map object untuk dataset metadata agar option, description, dan year visibility tidak terpisah.
- Tambahkan handling error yang menampilkan pesan backend `error` secara langsung.

## Map Layers

- Basemap dikonfigurasi di `BASEMAP_DEFINITIONS` dalam `frontend/index.html`.
- Map utama, result map, disaster map, dan LULC change map memakai Leaflet layer control untuk pilihan Roads, Satellite, Topographic, Terrain Relief, Dark, dan Light.
- Leaflet tetap 2D. Opsi `Terrain Relief` memberi tampilan relief/topografi, bukan scene 3D penuh.
- Batas administratif tingkat bawah memakai endpoint `GET /api/regions/children-geometries`.
- Default setelah load provinsi/kota/kecamatan hanya batas wilayah terpilih yang tampil. User dapat menekan `Show Inner Boundary` untuk menampilkan kota/kecamatan/kelurahan di dalamnya.
- Klik batas anak akan mengubah AOI ke wilayah yang diklik dan membuka level bawah berikutnya.

## Manual Smoke Test

1. Jalankan frontend dengan `npm run dev`.
2. Pastikan backend aktif dan GEE initialized.
3. Pilih AOI kecil.
4. Pilih module carbon.
5. Pilih dataset reference.
6. Jalankan analisis.
7. Cek layer map, statistik, total carbon, CO2e, dan report.

Jika request gagal, tampilkan pesan backend apa adanya agar user tahu apakah masalahnya GEE credential, dataset kosong, model tidak deployable, atau AOI terlalu besar.
