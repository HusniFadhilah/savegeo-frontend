# SAVEGEO frontend release runbook

Versi sumber frontend berada di `package.json`. Rilis produk awal ditetapkan sebagai `1.0.0`; jangan menaikkan versi pada setiap commit. Gunakan PATCH, MINOR, atau MAJOR sesuai aturan di `CHANGELOG.md`, sedangkan `GITHUB_RUN_NUMBER` dan `GITHUB_RUN_ATTEMPT` hanya menjadi metadata build.

## Build dan metadata

`npm run build` membuat `dist/build-metadata.json` melalui `prebuild`. Di GitHub Actions, metadata mengambil `GITHUB_RUN_NUMBER`, `GITHUB_RUN_ATTEMPT`, `GITHUB_SHA`, ref, workflow, run URL, environment, dan waktu UTC. File hanya berisi metadata publik; tidak pernah membaca `.env` atau secret.

Validasi lokal:

```powershell
npm ci
$env:SAVEGEO_DEPLOYMENT_ENVIRONMENT = "local"
npm run build
node scripts/validate-build-metadata.mjs dist/build-metadata.json
```

Workflow production/beta memvalidasi SHA pada artifact sebelum artifact di-deploy. Deployment sukses baru dicatat setelah health check yang sudah ada lulus.

## Pairing dengan backend

Backend memiliki nomor workflow dan riwayat Git sendiri. Download deployment record frontend dan backend dari workflow masing-masing, lalu gabungkan keduanya ke manifest kanonik di repo backend (`release/v1.0.0.json`). `product_version` harus sama; component version, build number, run attempt, full SHA, workflow URL, environment, dan waktu deploy dicatat per komponen.

Frontend menampilkan versi produk, build, SHA singkat, dan status pasangan melalui modal Status Sistem. Jika `/api/version` gagal, fungsi utama tetap berjalan dan UI menampilkan `metadata tidak tersedia`.

## Tag dan rollback

Setelah pasangan production disetujui, buat tag `v1.0.0` pada commit frontend yang benar-benar dibangun; tag backend dibuat terpisah pada commit backend yang benar-benar dibangun. Jangan membuat tag atau menjalankan deploy hanya untuk mengisi dokumentasi. Rollback berarti menjalankan kembali workflow pada pasangan commit yang telah tercatat baik dan melakukan health check ulang.
