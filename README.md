# SAVEGEO Frontend

Frontend SAVEGEO berbasis React 18, TypeScript, Vite, React Router, Zustand, TanStack Query, Leaflet, dan Chart.js.

Runbook deployment dan operasi tersedia di [OPERATIONS.md](OPERATIONS.md).

## Prasyarat

- Node.js 20 LTS
- npm 10 atau lebih baru
- Git
- Backend SAVEGEO berjalan atau URL backend yang dapat diakses

Pada Windows PowerShell, gunakan `npm.cmd` bila execution policy memblokir `npm`.

## Instalasi Lokal

```powershell
cd savegeo/frontend
npm ci
```

Buat `.env.local`:

```dotenv
VITE_API_BASE_URL=/api
VITE_APP_NAME=SAVEGEO
VITE_APP_ENV=development
```

Nilai `VITE_` bersifat publik karena di-inline ke bundle browser. Jangan masukkan API key, password, JWT secret, private key, atau service-role key ke frontend.

## Menjalankan Frontend

Pastikan backend berjalan di port `8086`. Vite meneruskan request `/api` dan `/disaster-thumbnails` ke backend, sehingga browser tetap memakai origin `http://localhost:5501`. Jalankan:

```powershell
npm run dev
```

Buka `http://localhost:5501`.

Perintah lain:

```powershell
npm run build
npm run preview
npm run lint
npm test
```

## Production Build

Production menggunakan same-origin reverse proxy:

```dotenv
VITE_API_BASE_URL=/api
VITE_APP_ENV=production
```

Validasi dan build:

```powershell
npm ci
npm run lint
npm test
npm audit --audit-level=high
npm run build
```

Hasil build berada di `dist/`.

## Modul Aplikasi

- Dashboard dan status koneksi
- Pemetaan karbon, vegetasi, dan tutupan lahan
- Perubahan tutupan lahan
- Pemetaan bencana dan event imagery
- Chatbot geospasial
- Administrasi credential, model, konfigurasi, dan company boundary

## Konfigurasi API

API dipanggil melalui `src/services/apiClient.ts` dan prefix `VITE_API_BASE_URL`.

Production:

- Frontend: `https://savegeo.husnifd.my.id`
- API same-origin: `https://savegeo.husnifd.my.id/api`
- Backend domain: `https://begeo.husnifd.my.id`

Reverse proxy harus meneruskan `/api/` dan `/disaster-thumbnails/` ke backend FastAPI.

## Testing dan Security

```powershell
npm run lint
npm test
npm audit --audit-level=high
npm run build
```

GitHub Actions menjalankan Gitleaks sebelum deployment. Token admin berada di `sessionStorage`; request API terpusat; dan konten HTML chat disanitasi sebelum ditampilkan.

## Deployment

- `.github/workflows/deploy-production.yml`: server production.
- `.github/workflows/ci.yml`: validasi Pull Request.
- `.github/workflows/code-review.yml`: Alibaba OpenCodeReview.

Deployment menjalankan lint, test, npm audit, build, Gitleaks, upload `dist/`, reload web server, dan health check domain. Secret deployment disimpan di GitHub Actions Secrets.

## Struktur Utama

```text
src/config/       Environment dan konfigurasi basemap
src/services/     API client dan service bersama
src/features/     Modul carbon, vegetation, landcover, disaster, admin, chatbot
src/components/   Komponen layout dan map
src/hooks/        Hook dan store aplikasi
src/styles/       Style global
public/           Asset statis
dist/             Output production build
```

## Troubleshooting

- `localhost:8086` di production: build dengan `VITE_API_BASE_URL=/api`.
- CORS: pastikan frontend memakai `/api` dan reverse proxy aktif.
- Thumbnail `404`: pastikan proxy `/disaster-thumbnails/` aktif.
- Halaman kosong: periksa console browser, hasil build, dan `/api/health`.
- Login gagal: pastikan backend aktif, migration selesai, dan akun admin tersedia.

# Versi dan rilis

SAVEGEO menggunakan versi produk bersama untuk frontend dan backend. Mulai 1.1.0, kedua repository menaikkan versi secara terkoordinasi sebelum rilis: MAJOR untuk perubahan yang tidak kompatibel, MINOR untuk kemampuan baru yang kompatibel, dan PATCH untuk perbaikan yang kompatibel. Riwayat sebelum 1.1.0 tidak direkonstruksi dari nomor build.

Ubah `version` pada `package.json` dan kedua entri versi proyek pada `package-lock.json` bersama versi backend; pembuatan metadata akan gagal bila keduanya tidak cocok. Nomor build adalah nomor run workflow masing-masing repository, bukan versi produk dan tidak dapat dibandingkan antar-workflow. Commit SHA, ID run, dan percobaan mengidentifikasi artefak yang benar-benar dibuat. Build lokal ditandai `local` dan tidak mengklaim sebagai deployment production.

Sebelum rilis, jalankan lint, tes, audit, build, dan uji integrasi; cocokkan versi produk frontend dan backend serta catat SHA dan workflow deployment yang berhasil. Label versi sama hanya menunjukkan nomor versi cocok, bukan bukti pengujian kompatibilitas. Kegagalan validasi atau deployment harus diperbaiki sebelum rilis dinyatakan selesai.

## 1.1.0

Baseline versi terkoordinasi pertama setelah 1.0.0, mencakup peningkatan keamanan, analisis dan pemantauan, serta penjelasan status sistem. Rincian riwayat perubahan tersedia pada commit Git masing-masing repository.
