# Prompt Integrasi Fire Emissions Watch untuk SaveGeo

> Salin seluruh prompt di bawah ke agen coding yang memiliki akses ke repository SaveGeo.

---

## Tujuan

Integrasikan data **Fire Emissions Watch dari Copernicus Atmosphere Monitoring Service (CAMS)** ke halaman:

**/pemetaan-bencana/karhutla/kalimantan-2026**

Gunakan gambar referensi yang dilampirkan sebagai arahan visual untuk layer sebaran emisi/asap bergradasi ungu-magenta dan merah muda. Gambar itu hanya referensi tampilan; jangan menganggapnya sebagai data, variabel, rentang nilai, legenda, atau bukti lokasi yang dapat dipakai ulang.

Kerjakan integrasi end-to-end pada repository ini: frontend, backend, pemrosesan data, API, visualisasi peta, pengujian, dokumentasi konfigurasi, serta laporan hasil. Pertahankan kemampuan yang sudah ada pada halaman Karhutla, termasuk filter tanggal, tingkat keyakinan NASA FIRMS, filter administrasi, statistik hotspot, layer peta, dan navigasi.

Sebagai bagian dari pekerjaan, perbarui pula arsip observasi NASA FIRMS untuk event `kalimantan-2026` dari tanggal data terakhir yang tersimpan sampai tanggal terbaru yang benar-benar tersedia pada Oktober 2026. Periksa ketersediaan tanggal melalui API resmi FIRMS; jangan menyimpulkan cakupan dari tanggal server atau menambahkan angka statis. Gunakan upsert idempoten, pertahankan provenance sensor dan waktu akuisisi UTC, lalu perbarui metadata `last_data_at`/`last_synced_at` dari hasil yang tersimpan.

## Konteks dan aturan sumber data

Fire Emissions Watch adalah aplikasi CAMS untuk melihat estimasi emisi kebakaran dan prakiraan transportasi asap. Informasi resmi menyebutkan aplikasi ini menggunakan data CAMS GFAS dan prakiraan atmosfer dari ECMWF IFS. GFAS tersedia untuk sejarah sejak 2003; sumber resmi membedakan GFAS v1.2 untuk 2003–2025 dan GFAS v1.4.2 untuk 2026 ke depan. Resolusi gridded yang tercantum pada katalog dataset ialah 0,1°; rentang waktu dan ketersediaan variabel harus dibaca dari metadata produk yang benar-benar digunakan.

Sumber resmi untuk diperiksa sebelum implementasi:

- Fire Emissions Watch: https://apps.atmosphere.copernicus.eu/fire-emissions-watch/
- Penjelasan CAMS tentang aplikasi dan metodologi: https://atmosphere.copernicus.eu/fire-emissions-watch-global-wildfire-emission-data-your-fingertips
- Katalog CAMS GFAS di Atmosphere Data Store: https://ads.atmosphere.copernicus.eu/datasets/cams-global-fire-emissions-gfas
- Dokumentasi resmi API Data Stores: https://cds.climate.copernicus.eu/en/how-to-api

Sebelum menulis kode, verifikasi metadata terkini untuk nama produk, versi, variabel, satuan, kalender/waktu, coverage, lisensi, frekuensi pembaruan, dan jalur API yang didukung. Aplikasi Fire Emissions Watch tidak otomatis menyediakan API publik atau layanan tile yang dapat ditanamkan. **Jangan** mengambil data dengan scraping HTML, meniru endpoint privat aplikasi, atau bergantung pada URL internal yang tidak terdokumentasi. Utamakan API resmi Atmosphere Data Store atau jalur distribusi CAMS resmi yang terdokumentasi. Jika akses perlu akun, token, atau persetujuan lisensi, jangan mengarang kredensial atau melewati persyaratan itu.

Simpan rahasia hanya pada konfigurasi backend, misalnya CAMS_ADS_API_URL dan CAMS_ADS_API_KEY jika nama tersebut cocok dengan client resmi yang dipilih. Jangan kirim token ke browser, jangan menulis nilai rahasia ke log, fixture, screenshot, atau laporan. Bila akun/token atau persetujuan syarat penggunaan belum tersedia, buat adapter dan mock yang dapat diuji, dokumentasikan konfigurasi yang dibutuhkan, tampilkan status belum dikonfigurasi secara jelas, dan tandai validasi upstream sebagai terblokir. Jangan tampilkan data contoh seolah-olah data CAMS aktual.

## Alur kerja repository

1. Baca AGENTS.md, konfigurasi, test scripts, serta dokumentasi proyek yang relevan sebelum mengubah kode.
2. Telusuri implementasi halaman Karhutla dan komponen peta yang sekarang: pemuatan event API vs fallback, WildfireLayerPanel, filter tanggal/tingkat keyakinan/wilayah, basemap, tile proxy, service backend, cache, dan aturan autentikasi/publikasi.
3. Petakan data flow yang akan dibuat dari CAMS resmi → service backend → respons/tiles → frontend → peta dan statistik. Pastikan tidak ada bagian yang bergantung pada endpoint internal Fire Emissions Watch.
4. Perbaiki akar masalah pada kode dan tambah tes regresi sebelum menyatakan pekerjaan selesai. Jangan hanya menyembunyikan 404, kesalahan provider, atau kegagalan render. Untuk sinkronisasi FIRMS, deteksi metadata respons yang terpotong karena batas jumlah fitur; pecah rentang tanggal dan bila perlu bounding box secara berulang, atau batalkan sinkronisasi dengan jelas. Jangan menyimpan hasil parsial seolah-olah lengkap.
5. Jalankan tes yang aman dan relevan di frontend/backend. Hindari test runner atau fixture yang menyentuh database production, Earth Engine live, atau mengirim permintaan upstream berbiaya.
6. Catat tes yang dijalankan, hasil, keterbatasan akses kredensial/lisensi, migrasi yang dibutuhkan, file yang berubah, dan langkah deploy.

## Kebutuhan fungsional

### 1. Layer emisi dan prakiraan asap

- Tambahkan bagian **Emisi kebakaran dan sebaran asap (CAMS)** pada halaman detail Karhutla Kalimantan 2026. Buat ringkas dan dapat diciutkan; jangan memenuhi tampilan awal halaman.
- Sediakan pilihan terpisah untuk:
  - **Emisi GFAS**: estimasi sumber/emisi pada waktu observasi atau analisis.
  - **Sebaran/prakiraan asap IFS-CAMS**: transportasi dan prakiraan atmosfer, hanya jika produk resmi serta waktu prakiraan yang dibutuhkan tersedia.
- Jangan menyamakan emisi sumber kebakaran dengan konsentrasi asap permukaan, kualitas udara yang terukur, luas terbakar, atau jumlah hotspot. Jelaskan mana yang merupakan estimasi GFAS dan mana yang merupakan prakiraan IFS.
- Tampilkan layer emisi di peta utama dengan opacity yang dapat diatur, legenda berunit, metadata sumber, waktu valid/analisis, versi dataset, dan keterangan resolusi. Warna ungu-magenta/merah muda dapat mengikuti referensi visual jika kontras dan maknanya tetap jelas.
- Gunakan rentang warna yang dapat dibaca di atas basemap terang maupun gelap, memiliki urutan nilai yang bermakna, serta memiliki alternatif selain warna saja (nilai/legenda/tooltip). Jangan menetapkan batas kelas sembarang. Gunakan skala yang dinyatakan jelas; jika memakai normalisasi logaritmik atau persentil, beri label dan pastikan pembandingan lintas tanggal tetap dapat dipahami.
- Tooltip/klik sel menampilkan nilai variabel, satuan, tanggal/waktu, versi/sumber, dan status estimasi/prakiraan. Nilai nodata harus transparan dan tidak boleh disajikan sebagai nol.

### 2. Variabel, waktu, dan kontrol animasi

- Bangun daftar variabel dari metadata produk yang benar-benar tersedia. Evaluasi minimal karbon dioksida, karbon monoksida, PM2.5, total karbon, dan fire radiative power jika produk resmi mengizinkan variabel tersebut. Jangan mengasumsikan semua variabel tersedia untuk semua versi/waktu.
- Tampilkan nama singkat dan nama lengkap, simbol kimia bila relevan, unit asli, serta ringkasan definisi. Pastikan konversi unit dan agregasi waktu sesuai dokumentasi produk.
- Sediakan pemilih rentang tanggal dan **slider waktu horizontal** untuk berpindah tanggal/waktu historis. Untuk data harian historis, langkahnya harian; untuk data 2026 yang berfrekuensi lebih tinggi, ikuti temporal resolution yang tersedia. Jangan menawarkan jam yang tidak ada di produk.
- Sediakan tombol putar/jeda dan kecepatan animasi, serta tanggal yang sedang ditampilkan. Saat berpindah waktu, sinkronkan layer, nilai legenda, grafik, dan statistik.
- Tampilkan zona waktu secara eksplisit. Normalisasikan penyimpanan/query ke UTC jika sesuai produk; tampilkan ke pengguna dalam zona waktu yang ditetapkan aplikasi dan cegah tanggal bergeser di batas hari.
- Filter tanggal hotspot NASA FIRMS boleh diselaraskan bila masuk akal, tetapi sediakan penjelasan serta kontrol yang jelas. Filter confidence hanya berlaku untuk NASA FIRMS; **jangan** menerapkan confidence hotspot pada estimasi CAMS.

### 3. Statistik dan ringkasan wilayah

- Dukung ringkasan emisi untuk seluruh Kalimantan dan batas provinsi yang menjadi cakupan event (61–65 bila data registry event memastikan kode ini benar). Jika batas wilayah yang lebih rinci tersedia dan akurat, dukung pula kabupaten/kota.
- Bedakan:
  - nilai maksimum/mean per sel,
  - total emisi terintegrasi untuk batas wilayah dan periode,
  - total emisi harian/bulanan/akumulasi periode,
  - FRP bila dipilih.
- Gunakan luas sel dan durasi langkah waktu yang benar saat mengintegrasikan flux menjadi massa. Verifikasi unit dan rumus terhadap metadata resmi; jangan menjumlahkan flux mentah seolah-olah sudah berupa massa. Tulis unit keluaran serta rumus/periode agregasi pada dokumentasi dan tooltip.
- Statistik emisi harus terpisah dari jumlah hotspot dan luas terbakar. Jangan menjumlahkan data yang memakai versi, unit, periode, atau semantik berbeda tanpa normalisasi yang terbukti.
- Grafik menampilkan deret waktu emisi dan memungkinkan pengguna membandingkan provinsi/periode yang sama. Perbandingan antartanggal memakai skala konsisten atau secara eksplisit menjelaskan jika skala berubah.

### 4. Arsitektur backend dan performa

- Tambahkan service/provider CAMS di backend mengikuti pola service yang sudah ada. Pisahkan client upstream, validasi parameter, cache, pemrosesan raster/gridded data, dan pembuatan tile.
- Usulkan route yang konsisten dengan route Karhutla, misalnya:
  - GET /api/disasters/wildfires/events/{slug}/emissions/capabilities
  - GET /api/disasters/wildfires/events/{slug}/emissions/summary
  - GET /api/disasters/wildfires/events/{slug}/emissions/regions
  - route tile/COG hanya jika format dan cara penyajian upstream mendukungnya.

  Sesuaikan nama/path dengan konvensi backend yang ditemukan. Semua route publik harus memvalidasi bahwa slug adalah event Karhutla yang dipublikasikan, serta mengikuti feature permission/authorization yang berlaku.
- Batasi rentang tanggal, variabel, batas spasial, resolusi, ukuran jawaban, timeout, retry, jumlah job, dan frekuensi permintaan. Gunakan cache server dengan kunci yang mencakup variabel, versi produk, wilayah, waktu, dan parameter visual yang memengaruhi data.
- Jangan unduh data global besar berulang kali untuk setiap render peta. Clip proses ke area Kalimantan, gunakan request subset resmi bila tersedia, cache hasil, dan siapkan tiling/COG server-side yang sesuai. Jika pengunduhan bersifat job, implementasikan status job, deduplikasi, timeout, pembatalan, dan pembatasan concurrency sesuai pola aplikasi.
- Tangani rentang data kosong, data terlambat, upstream error, token/terms belum dikonfigurasi, dan versi produk yang tidak tersedia dengan respons yang dapat dibedakan. Jangan mengembalikan HTTP 404 untuk setiap tile di luar coverage bila kontrak peta mengharapkan tile kosong; gunakan tile PNG transparan untuk no-data dan pertahankan 404 untuk event/imagery yang memang tidak ditemukan atau tidak dipublikasikan.
- Pertahankan cache-control dan autentikasi dengan cermat. Jangan mencache respons privat lintas pengguna. Jangan menulis API key, URL bertoken, atau isi kredensial ke log.
- Atribusikan CAMS/ECMWF dan versi data sesuai ketentuan lisensi. Berikan tautan sumber dan tanggal akses/pembaruan.

### 5. Keadaan UI dan aksesibilitas

- Default layer emisi/asap mati dan panelnya diciutkan; pengguna mengaktifkannya secara sengaja.
- Saat user membuka halaman Karhutla, konfirmasi dahulu event server sebelum memanggil route yang memerlukan event tersebut. Jangan memicu request statistik/tile untuk event fallback statis yang belum dikonfirmasi server.
- Tampilkan status loading, data kosong, data kedaluwarsa, tidak ada akses, upstream error, dan token belum dikonfigurasi. Pesan harus membedakan kegagalan akses dari nilai emisi nol.
- Periksa dark mode, ukuran layar kecil, keyboard, label kontrol, focus state, kontras legenda, dan pembaca layar. Slider waktu harus dapat dioperasikan dengan tombol panah; playback tidak boleh menghalangi kontrol peta.
- Panel baru tidak boleh menduplikasi kontrol waktu atau keterangan sumber yang sudah ada. Tetapkan satu sumber kebenaran untuk rentang tanggal aktif dan hindari permintaan berulang akibat perubahan select/state.

## Kriteria ilmiah dan kualitas data

- Ikuti metadata CAMS: versi produk, resolusi, waktu valid, waktu publikasi, sistem koordinat, variabel, skala, offset, nodata, unit, dan lisensi.
- Jelaskan bahwa GFAS memperkirakan emisi dari observasi FRP dan faktor emisi; itu bukan inventaris langsung seluruh emisi yang diukur di permukaan.
- Perlakukan IFS sebagai prakiraan komposisi/transportasi atmosfer, bukan observasi satelit atau pengukuran stasiun lokal. Paparkan waktu inisialisasi dan lead time.
- Jangan menurunkan risiko kesehatan penduduk atau konsentrasi permukaan secara langsung dari nilai emisi sumber tanpa produk/korelasi atmosfer yang memang menyediakan pengukuran tersebut.
- Simpan provenance yang cukup untuk reproduksi: provider, nama/versi dataset, variabel, query, periode valid, timestamp pengambilan, resolusi, unit, versi batas wilayah, dan cache key.
- Sertakan metode validasi: bandingkan beberapa tanggal/wilayah dengan Fire Emissions Watch resmi dan unduhan/data resmi CAMS, dengan toleransi yang dijelaskan. Perbedaan tampilan warna bukan bukti kesetaraan angka.

## Pengujian wajib

### Backend

- Unit test konversi flux → massa, integrasi temporal, konversi unit, luas sel, clipping AOI, agregasi provinsi, timezone, nodata, dan nilai ekstrim.
- Test validasi tanggal/variabel/versi/region; event tidak ada/draft; pengguna tanpa feature permission; upstream timeout/429/5xx; kredensial tidak tersedia; retry; cache hit/miss/stale; serta keamanan log.
- Test respons empty-data, metadata/provenance, tile valid, tile transparan di luar coverage, raster rusak, dan tidak membocorkan data event yang belum dipublikasikan.
- Gunakan fixture kecil sintetis dengan nilai yang dapat dihitung tangan. Mock upstream; jangan melakukan download besar atau permintaan berbayar selama tes.

### Frontend dan browser

- Test panel collapsed/expanded, toggle layer, variabel, tanggal, slider horizontal, playback, update legenda, statistik wilayah, perubahan bahasa, dark mode, empty/error/loading states, dan reset filter.
- Pastikan overlay dapat dipadukan dengan base map, batas administrasi, NASA FIRMS, dan layer hotspot tanpa menimpa state atau mengirim request duplikat.
- Uji bahwa event fallback statis tidak memanggil endpoint wilayah/emisi hingga API memastikan event publik.
- Jalankan browser E2E pada staging/dev dengan fixture: buka route target, pilih emisi CO2, ubah waktu pada slider, pilih provinsi, putar/jeda animasi, matikan layer, dan pastikan semua request/response sesuai kontrak. Periksa console dan network.
- Jika upstream resmi memerlukan token atau persetujuan lisensi yang tidak tersedia, jalankan semua tes mock/fixture, dokumentasikan skenario upstream sebagai **TERBLOKIR**, dan jangan menyebut uji data live lulus.

## Definition of done

- Layer CAMS GFAS/IFS terintegrasi pada halaman Karhutla 2026 dengan visual mirip arahan referensi, legenda dan unit benar, waktu dapat dijelajahi lewat slider, serta atribusi dan batasan ilmiah terlihat.
- Emisi, asap prakiraan, hotspot FIRMS, dan luas terbakar ditampilkan sebagai produk berbeda dengan provenance masing-masing.
- Tidak ada 404 berulang untuk event fallback, tile no-data, atau request duplikat; respons 404 yang tersisa hanya untuk resource yang memang tak ada/tidak publik dan memiliki perilaku UI yang jelas.
- Tes backend/frontend dan build/lint relevan lulus. Hasil browser dan sumber upstream dibuktikan atau ditandai terblokir secara jujur.
- Tulis laporan singkat tentang implementasi, metode/perhitungan, perubahan konfigurasi/migrasi, tes, batasan, dan langkah deploy. Jangan commit/push kecuali diminta secara terpisah.

---

Mulai dengan audit kode dan kontrak sumber CAMS. Setelah akar masalah dan rancangan data dipastikan, implementasikan keseluruhan alur dan verifikasi. Jika layanan resmi/API tidak dapat diakses, selesaikan adapter, UI, tes fixture, dan dokumentasi yang aman; tandai akses live sebagai terblokir dan jangan mengganti data nyata dengan angka rekaan.
