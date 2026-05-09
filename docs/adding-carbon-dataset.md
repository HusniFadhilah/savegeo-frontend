# Adding A Carbon Dataset In The Frontend

Gunakan checklist ini ketika backend menambah dataset referensi karbon baru, misalnya workflow GEDI L4B + Sentinel-2/Sentinel-1/DEM/Dynamic World.

## Checklist

1. Tambahkan `<option>` pada `#carbonReferenceDataset`.
2. Tambahkan deskripsi di `updateDatasetDescription()`.
3. Update `updateYearSelectorVisibility()` jika dataset punya pilihan tahun.
4. Pastikan `runCarbonAnalysis()` mengirim `reference_dataset` dengan key backend yang sama.
5. Pastikan display statistik membaca detail dari `carbon_reference`, bukan hanya dari `model_info`.
6. Update export report agar nama dataset, tahun, dan resolusi muncul benar.
7. Uji dengan AOI kecil sebelum mencoba AOI besar.

## Backend Sync Checklist

Sebelum atau sesudah update frontend, pastikan backend sudah punya:

- Key dataset yang sama di `load_carbon_reference_dataset`.
- Metadata dataset di `get_dataset_info`.
- Loader training jika dataset dipakai untuk training.
- Model registry metadata for compatible models.
- Model listing filter by selected dataset if available.
- Dokumentasi unit dan target pool.
- Error message yang jelas jika dataset/model tidak kompatibel.

## Contoh Dataset GEDI Stack

Jika backend memilih key `GEDI_L4B_STACK`, option UI bisa seperti:

```html
<option value="GEDI_L4B_STACK">GEDI L4B + S2/S1/DEM Stack (2019-2023, 1km target)</option>
```

Deskripsi ringkas:

```js
'GEDI_L4B_STACK': '<i class="fas fa-info-circle"></i> GEDI L4B biomass target with Sentinel-2, Sentinel-1, DEM, and Dynamic World forest mask predictors. Converts biomass to carbon with a 0.47 carbon fraction.'
```

Year selector:

- Jika backend hanya memakai fixed GEDI L4B image `LARSE/GEDI/GEDI04_B_002`, sembunyikan year selector untuk reference dataset.
- Jika backend membuat composite/predictor tahunan, tetap gunakan `year` utama analisis untuk predictor period.

## Contoh Dataset Open-Source Benchmark

Jika backend memilih key `OPENLANDMAP_SOC`, option UI bisa seperti:

```html
<option value="OPENLANDMAP_SOC">OpenLandMap Soil Organic Carbon (soil carbon)</option>
```

Deskripsi ringkas:

```js
'OPENLANDMAP_SOC': '<i class="fas fa-info-circle"></i> Soil organic carbon from OpenLandMap. This represents a soil carbon pool, not aboveground biomass carbon.'
```

Jika backend memilih key `ORNL_AGB_BGB`, option UI bisa seperti:

```html
<option value="ORNL_AGB_BGB">NASA ORNL AGB+BGB Carbon Density</option>
```

Deskripsi ringkas:

```js
'ORNL_AGB_BGB': '<i class="fas fa-info-circle"></i> NASA ORNL biomass carbon density combining aboveground and belowground carbon pools when both bands are available.'
```

Jika backend memilih key `GEDI_L4A_MONTHLY`, option UI bisa seperti:

```html
<option value="GEDI_L4A_MONTHLY">GEDI Monthly AGBD Carbon Proxy</option>
```

Deskripsi ringkas:

```js
'GEDI_L4A_MONTHLY': '<i class="fas fa-info-circle"></i> GEDI monthly aboveground biomass density converted to carbon with a 0.47 carbon fraction.'
```

## UI Copy

Jangan menjanjikan bahwa dataset baru lebih akurat secara umum. Untuk GEDI, copy yang aman:

- "Best for forest biomass calibration where GEDI coverage is available."
- "Resolution follows GEDI target scale; detailed map output depends on predictor stack and model."

Untuk SOC/OpenLandMap, copy harus menyebut soil carbon agar user tidak mengira hasilnya sama dengan stok karbon biomassa di atas tanah.

## Compatibility Note

Frontend hanya memilih reference dataset dan model. Jika dataset baru membutuhkan model khusus, backend tetap harus memvalidasi kompatibilitas dan mengembalikan error yang jelas. Frontend boleh menampilkan hint, tetapi jangan menyembunyikan model secara hardcoded kecuali backend menyediakan metadata kompatibilitas.

## Verification

Setelah edit UI:

- Dropdown menampilkan dataset baru.
- Deskripsi berubah ketika option dipilih.
- Payload network mengirim `reference_dataset` yang benar.
- Response sukses menampilkan tile estimasi dan tile reference.
- Statistik dan report memakai nama dataset yang benar.
- Untuk SOC, label/deskripsi tidak menyebut aboveground biomass.
