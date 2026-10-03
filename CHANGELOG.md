# Changelog SAVEGEO Frontend

## v1.0.0 — 2026-10-03 — kandidat rilis, belum diverifikasi production

Pasangan sumber kandidat ini berhenti pada commit lokal `26545af1c5395b19e5b177a69d396dcfab9050ea`. Perubahan lokal yang belum dikomit tidak termasuk catatan rilis. Belum ada klaim bahwa commit ini sudah berhasil dideploy ke production; verifikasi harus dilakukan melalui workflow production dan manifest pasangan.

### Fitur

- Penyempurnaan panel analisis geospasial dan layout peta.
- Dukungan imagery Himawari dan sumber imagery USGS lama.
- Alur analisis bencana, segmentasi, perbandingan citra, dan pemantauan kejadian.
- Dashboard admin untuk pengelolaan pengguna, model, provider satelit, geospasial, dan profil.

### Perbaikan dan keamanan

- Asset Vite ber-hash lama dipertahankan saat deploy agar tab yang masih terbuka tetap dapat memuat resource.
- Build mempertahankan lint, test, audit npm, dan Gitleaks dengan image registry GHCR.
- Metadata versi/build kini dapat ditelusuri dari artifact frontend.

### Aturan rilis berikutnya

- PATCH untuk perbaikan kompatibel ke belakang.
- MINOR untuk kemampuan baru yang kompatibel.
- MAJOR untuk perubahan kontrak atau migrasi yang tidak kompatibel.
- Nomor build workflow tidak menaikkan SemVer; build dan run attempt dicatat sebagai metadata.
