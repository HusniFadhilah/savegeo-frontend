# Laporan Pengujian SaveGeo Chatbot

**Tanggal:** 6 Oktober 2026  
**Status:** **TERBATAS** — pemeriksaan lokal lulus untuk cakupan yang dijalankan, tetapi chatbot pada situs live belum dapat diuji karena akses jaringan dari browser sesi ini ditolak.

## Ringkasan hasil

Pengujian ulang frontend meluluskan **107 tes pada 34 file**. Suite backend terpilih yang aman meluluskan **41 tes**, termasuk pemeriksaan isolasi sesi, validasi action, grounding hasil, izin Viewer, adapter provider, dan migrasi SQLite sementara. Lint chatbot/frontend dan Ruff lulus. Build frontend dan pemeriksaan metadata build juga lulus.

Uji browser terhadap `https://savegeo.len.co.id` terhenti sebelum halaman terbuka dengan `net::ERR_NETWORK_ACCESS_DENIED`. Tidak ada kredensial yang dikirim. Pemeriksaan nama key pada file environment hanya menemukan konfigurasi email, bukan akun login aplikasi. Browser lokal dapat membuka hasil build dan merender aplikasi, tetapi ini tidak membuktikan perilaku chatbot atau koneksi layanan live.

Pemeriksaan tambahan `i18n:audit` **gagal pada satu fatal** di `src/components/map/MapExportControl.tsx:191`, karena literal `&#39;` untuk escape apostrof dianggap sebagai masalah encoding. Audit juga melaporkan banyak kandidat teks UI hardcoded. Temuan itu berada di luar fitur chatbot dan tidak diubah dalam pengujian ini; statusnya dicatat sebagai pekerjaan terpisah.

## Matriks pemeriksaan

| Area | Pemeriksaan | Hasil |
|---|---|---|
| Frontend | `npm.cmd test` | **Lulus:** 34 file, 107 tes |
| Frontend lint | ESLint pada `src/features/chatbot`, `CarbonModule.tsx`, dan `carbon/api.ts` | **Lulus** |
| Backend terpilih | Tes sesi, action/grounding, provenance karbon, provider Ollama, izin Viewer, dan migrasi | **Lulus:** 41 tes; 32 peringatan deprecation dari Pydantic/Starlette |
| Backend lint | Ruff pada berkas chatbot, sesi, dan filter terkait | **Lulus** |
| Production build | `npm.cmd run build` | **Lulus**; 2.049 modul diproses, 389 aset statis disalin |
| Metadata build | `npm.cmd run validate:build-metadata` | **Lulus:** metadata `1.0.0`, build `local` |
| Audit i18n | `npm.cmd run i18n:audit` | **Gagal:** satu fatal `&#39;` di sanitizer `MapExportControl.tsx`; 1.119 kandidat peringatan hardcoded |
| Migrasi | `alembic history` | **Lulus:** `0028_chat_session_owner` terbaca sebagai head setelah `0027_viewer_features` |
| Browser lokal | Playwright Chromium, Vite preview pada `127.0.0.1:4173` | **Lulus terbatas:** HTTP 200, judul dan root React tampil, 0 JavaScript page error. Dua error resource berasal dari request eksternal yang sengaja diblokir; host yang terlihat `upload.wikimedia.org`. Preview dihentikan setelah uji. |
| Browser live | `https://savegeo.len.co.id` | **Terblokir:** `ERR_NETWORK_ACCESS_DENIED`; login dan percakapan live tidak dijalankan |

Build memberi peringatan nonfatal tentang chunk JavaScript di atas 500 kB dan dynamic import `geotiff`/`togeojson` yang tidak memecah chunk. Build tetap selesai dengan exit code 0.

## Cakupan backend yang aman

Suite backend lengkap tidak dijalankan. Beberapa fixture dan lifespan aplikasi membuka koneksi ke database dari konfigurasi proyek serta menginisialisasi Earth Engine. Untuk menghindari perubahan atau akses tak sengaja ke layanan yang bukan fixture, hanya suite yang menggunakan SQLite sementara, mock, atau fixture deterministik yang dijalankan. Tidak ada database production yang diubah.

Suite terpilih memeriksa:

- Pemilik sesi user/admin, pembuatan dan daftar sesi, baca/ubah/hapus, serta penolakan akses lintas pemilik.
- Endpoint agent menolak sesi milik akun lain sebelum model dipanggil; sesi lama tanpa pemilik tidak ditampilkan.
- Validasi action dan parameter, kebutuhan AOI, layer yang tersedia, serta penolakan hasil/action yang tidak dipetakan.
- Grounding hasil: data yang tidak tersedia tidak direka; fitur yang tidak diizinkan, metadata internal, URL tile, dan parameter visual tidak dibocorkan ke konteks model.
- Pemisahan layer referensi karbon dan LULC berdasarkan izin; entri lama tanpa jenis analisis ditolak; tahun efektif berbeda tidak digabung menjadi satu periode.
- Provenance karbon, adapter Ollama, izin Viewer, dan upgrade/downgrade migrasi pada SQLite sementara.

Tes ini memeriksa aturan aplikasi dan jalur data dengan fixture. Tes tersebut tidak mengukur ketepatan model live atau menghitung ulang keluaran geospasial nyata.

## Temuan dan perbaikan chatbot yang diverifikasi

### Kepemilikan riwayat chat

Pemeriksaan kode sebelumnya menemukan route sesi dan agent dapat mengandalkan ID sesi tanpa pemeriksaan pemilik yang memadai. Perubahan lokal menambahkan owner key dengan namespace user/admin, membatasi operasi sesi kepada pemiliknya, menyimpan pemilik sesi baru, dan mengembalikan 404 untuk sesi milik akun lain. Tes regresi backend terpilih lulus.

Migrasi `0028_chat_session_owner` menambahkan kolom/index pemilik. Riwayat lama dipertahankan tetapi tidak ditampilkan karena pemiliknya tidak dapat ditentukan dengan aman. Migrasi **belum diterapkan** pada database live; cek status Alembic target dan uji migrasi di staging sebelum deploy backend terkait.

### Grounding referensi lintas fitur

Perbaikan lokal memberi label jenis analisis pada layer referensi langsung, memfilter hasil karbon/LULC menurut izin, menolak baris legacy tanpa label, dan tidak mengirim URL tile atau parameter visual internal ke model. Layer dengan tahun efektif berbeda mempertahankan tahun masing-masing. Tes fixture untuk aturan ini lulus.

Perbaikan tersebut belum membuktikan isi jawaban pada model atau data production, karena tidak ada percakapan live yang dapat dijalankan.

## Skenario yang belum dijalankan

Semua kasus yang memerlukan autentikasi atau layanan live berstatus **TERBLOKIR**, bukan lulus:

- Login dengan akun yang tersedia dan pemeriksaan role/fitur di UI.
- Mengirim pertanyaan melalui widget, percakapan bertahap, pergantian bahasa, markdown, kartu/tautan, dan pengelolaan riwayat.
- Akurasi jawaban terhadap data karbon, vegetasi, LULC, bencana, tanaman, dan citra; atribusi sumber serta perilaku saat data tidak tersedia.
- Lampiran/file nyata, respons provider/model live, timeout, rate limit, retry, dan pesan kegagalan.
- Eksekusi action pada peta, hasil analisis geospasial live, console/network aplikasi, perangkat mobile, keyboard, dan aksesibilitas.
- Uji isolasi dengan dua akun aplikasi yang disetujui.

## Strategi menyelesaikan pengujian dan memperbaiki hasil

1. Jalankan prompt menyeluruh di `CHATBOT_QA_PROMPT.md` pada browser dengan akses jaringan dan akun uji yang tersedia melalui penyimpanan kredensial resmi. Jangan menyalin kata sandi, token, atau data pribadi ke log/laporan.
2. Cocokkan jawaban faktual dengan UI/API atau sumber data yang dapat dipercaya. Ulangi pertanyaan model yang tidak deterministik tiga kali dan catat perbedaan, sumber, waktu, dan versi aplikasi.
3. Untuk jawaban tanpa dukungan data, periksa tool/action yang dipilih, filter izin, provenance, cakupan waktu/AOI, dan payload yang dikirim ke model. Perbaiki aturan atau prompt/tool yang menjadi akar masalah, lalu buat tes regresi untuk kasus reproduksi.
4. Jalankan tindakan perubahan data, unggah, dan job analisis hanya di staging atau data uji disposable. Verifikasi hasil peta, angka, status job, dan jejak audit pada sumbernya.
5. Tutup temuan privasi/izin dan jawaban menyesatkan terlebih dahulu. Sesudah perbaikan, jalankan ulang tes terkait, suite frontend, suite backend pada lingkungan test terisolasi, lalu seluruh skenario browser yang gagal.
6. Sebelum rilis, cocokkan dan terapkan migrasi pada staging, kemudian ulangi validasi ownership dan alur chat. Jangan menganggap riwayat Alembic lokal membuktikan migrasi live sudah diterapkan.
7. Audit i18n perlu ditangani terpisah: pertahankan escape apostrof HTML yang aman dan sesuaikan aturan audit agar tidak menandainya sebagai teks mojibake; tinjau kandidat hardcoded satu per satu sebelum memindahkan string UI.

## Catatan repositori

Frontend dan backend memiliki banyak perubahan lokal lintas fitur selain chatbot. Semua perubahan dibiarkan apa adanya: tidak dibersihkan, di-stage, di-commit, atau di-push. Prompt dan laporan QA juga belum di-commit.
