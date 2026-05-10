# Map Layer UI Contract

Dokumen ini mencatat kontrak antara frontend `index.html` dan map layer registry backend.

## Inisialisasi

Saat `$(document).ready()`, frontend memanggil `loadMapLayerRegistry()` sebelum
`initializeMap()`. Fungsi ini:

1. Fetch `GET /api/basemaps` → populate `BASEMAP_DEFINITIONS` (JS object global).
2. Fetch `GET /api/map-layers` → populate `mapLayerRegistry` (JS object global, key → metadata).

Jika endpoint tidak tersedia, `BASEMAP_DEFINITIONS` tetap memakai nilai default bawaan.

## BASEMAP_DEFINITIONS

```js
// Sebelum: const BASEMAP_DEFINITIONS = { ... }  // hardcoded
// Setelah: let BASEMAP_DEFINITIONS = { ... fallback ... }
// Diisi ulang dari /api/basemaps saat load
```

Setiap entry:

```js
BASEMAP_DEFINITIONS["roads"] = {
  label: "Roads",
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "...",
  maxZoom: 19,
}
```

`addBasemapSwitcher(targetMap, defaultKey, addDefault)` membaca `BASEMAP_DEFINITIONS`
untuk membangun Leaflet layer control.

## mapLayerRegistry

Cache metadata semua layer dari `GET /api/map-layers`:

```js
mapLayerRegistry["carbon_estimated"] = {
  key: "carbon_estimated",
  name: "Estimated Carbon Stock",
  type: "analysis",
  module: "carbon",
  default_opacity: 0.85,
  vis_params: { min: 0, max: 200, palette: ["440154", ...] },
  unit: "Mg C/ha",
  ...
}
```

Dipakai oleh:
- `switchResultLayer()` — set `default_opacity` ke opacity slider dan tileLayer
- `updateLegend()` — fallback vis_params jika analisis response tidak punya vis_params
- `buildResultTabs()` — fallback name untuk tab `carbon_reference`

## Opacity Slider

HTML: `#layerOpacityControl` (div), `#layerOpacitySlider` (range input), `#layerOpacityValue` (span).

Perilaku:
- Slider muncul (`display: flex`) saat `switchResultLayer()` berhasil load tile URL.
- Slider tersembunyi (`hide()`) saat tidak ada tile URL.
- Nilai default diambil dari `mapLayerRegistry[layerName].default_opacity`.
- Mengubah slider secara real-time mengubah opacity layer aktif via `layer.setOpacity(val)`.

## Carbon Layer Label

Tab `carbon_reference` menggunakan:

```js
const refLabel = refMeta.name                               // dari carbon_reference.name (API response)
  || (mapLayerRegistry['carbon_reference'] || {}).name      // dari registry
  || 'Reference Carbon';                                    // ultimate fallback
```

Jangan hardcode nama dataset seperti "WCMC Reference" di tab atau legend.
Nama dataset selalu dibaca dari `carbon_reference.name` response backend.

## Legend — Carbon Layers

`updateLegend()` untuk `carbon_estimated` dan `carbon_reference`:

```js
const registryVis = (mapLayerRegistry[layerName] || {}).vis_params || {};
const apiVis = layerData.vis_params || {};
const effectiveVis = { ...registryVis, ...apiVis };  // API response wins
```

Urutan prioritas vis_params:
1. `carbon_estimated.vis_params` atau `carbon_reference.vis_params` dari analisis response
2. Registry default vis_params (dari `GET /api/map-layers`)
3. Hardcoded Viridis palette fallback

Urutan prioritas unit:
1. `carbon_reference.unit` (dari analisis response)
2. `carbon_estimated.unit`
3. Registry `unit`
4. `'Mg/ha'` fallback

Urutan prioritas layer name (legend title):
1. `carbon_reference.name`
2. `model_info.reference_dataset`
3. `'Reference Carbon'`

## Layer Control (Basemap Switcher)

Semua peta memakai `addBasemapSwitcher(map, 'roads', true)`:
- Parameter ketiga `true` berarti basemap default (`roads`) langsung ditambahkan ke peta.
- Layer control (radio button) menampilkan semua basemap dari `BASEMAP_DEFINITIONS`.
- Tidak ada lagi `L.tileLayer(OSM_URL).addTo(map)` hardcoded.

## Endpoint Summary

| Endpoint | Dipakai Untuk |
|---|---|
| `GET /api/basemaps` | Populate `BASEMAP_DEFINITIONS` |
| `GET /api/map-layers` | Populate `mapLayerRegistry` (semua layer) |
| `GET /api/map-layers?module=carbon` | Jika hanya butuh layer carbon |

## Fallback Behavior

Jika `/api/basemaps` gagal: `BASEMAP_DEFINITIONS` tetap berisi nilai default bawaan
(Roads, Satellite, Topo, Terrain, Dark, Light). Semua peta tetap berfungsi.

Jika `/api/map-layers` gagal: `mapLayerRegistry` kosong. Legend dan opacity slider
memakai hardcoded fallback (Viridis palette, opacity 0.85).
