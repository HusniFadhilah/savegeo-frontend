# Carbon UI Contract

Dokumen ini mencatat kontrak frontend untuk modul estimasi stok karbon.

## Input UI

Element penting di `index.html`:

- `#carbonReferenceDataset`: dropdown dataset referensi.
- `#carbonDatasetYear`: tahun dataset untuk dataset temporal.
- `#carbonModelSelect`: model karbon aktif.
- `#carbonCloudSlider` dan `#carbonCloudValue`: cloud threshold.
- `input[name="carbonClipMode"]`: mode clipped/full tiles.
- `#enableCarbonDelta`: enable analisis delta tahunan.

## Payload Ke Backend

`runCarbonAnalysis()` mengirim object berikut ke `apiClient.analyzeCarbon(params)`:

```js
{
  aoi,
  year,
  start_month,
  end_month,
  cloud_threshold,
  clip_to_aoi,
  reference_dataset,
  dataset_year,
  model_name,
  vis_min,
  vis_max,
  vis_palette
}
```

Jika backend membutuhkan parameter baru untuk dataset, usahakan optional dan punya default agar dataset lama tidak rusak.

## Response Yang Dipakai UI

Frontend memakai:

- `carbon_estimated.tile_url`
- `carbon_estimated.statistics.mean`
- `carbon_estimated.statistics.std_dev`
- `carbon_estimated.statistics.min`
- `carbon_estimated.statistics.max`
- `carbon_reference.name`
- `carbon_reference.full_name`
- `carbon_reference.year`
- `carbon_reference.resolution`
- `area_info.calculation_area_ha`
- `area_info.total_carbon_tons`
- `area_info.carbon_dioxide_equivalent_tons`
- `model_info.model_name`
- `model_info.algorithm`
- `model_info.cv_metrics`
- `model_info.reference_dataset`
- `model_info.scale`

Catatan: ada kode lama yang mencoba membaca `model_info.reference_dataset_info`. Backend saat ini menyediakan detail dataset di `carbon_reference`, jadi perbaikan frontend sebaiknya memakai `carbon_reference` sebagai sumber data utama.

## Dataset Values Saat Ini

Dropdown saat ini mengenal:

- `ESA_CCI`
- `WCMC`
- `GEDI`
- `Simard`

Jika backend menambah key baru seperti `GEDI_L4B_STACK`, `OPENLANDMAP_SOC`, `ORNL_AGB_BGB`, atau `GEDI_L4A_MONTHLY`, frontend harus menambah option dengan value yang sama persis.

## Dataset-Aware Model Selection

Model dropdown should be filtered by selected dataset. Preferred request:

```text
GET /api/models?model_type=carbon&target_dataset=<selected_dataset>&gee_deployable=true
```

When `#carbonReferenceDataset` changes:

1. Clear `#carbonModelSelect`.
2. Fetch compatible models for the selected dataset.
3. Populate only compatible models.
4. If no model exists, show a clear empty state and prevent analysis until a compatible model is selected.
5. Still handle backend compatibility errors because model metadata can become stale.

## Dataset Metadata Display Rules

Sumber utama metadata dataset adalah `carbon_reference`, bukan `model_info`.

Gunakan urutan fallback:

1. `carbon_reference.name`
2. `carbon_reference.full_name`
3. `model_info.reference_dataset`
4. string fallback seperti `Unknown Dataset`

Untuk tahun/resolusi:

1. `carbon_reference.year`
2. `carbon_reference.resolution`
3. fallback `N/A`

Untuk dataset soil organic carbon seperti `OPENLANDMAP_SOC`, UI harus menyebut soil/SOC di label atau deskripsi, karena angka tersebut tidak sama dengan aboveground biomass carbon.

## Delta Analysis Contract

Jika `#enableCarbonDelta` aktif, frontend dapat menambahkan hasil delta ke:

```js
analysisResults.carbon.carbon_delta
```

Report markdown membaca:

- `carbon_delta.series`
- `carbon_delta.deltas`
- `carbon_delta.summary.start_year`
- `carbon_delta.summary.end_year`
- `carbon_delta.summary.net_delta_total_carbon_tons`
- `carbon_delta.summary.net_delta_co2e_tons`
