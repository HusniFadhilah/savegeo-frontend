const LABELS: Record<string, string> = {
  aoi_area_ha: "Luas AOI", valid_area_ha: "Area valid", no_data_area_ha: "Area tanpa data", coverage_pct: "Cakupan valid",
  changed_area_ha: "Perubahan kelas", total_impacted_area_ha: "Perubahan genangan", new_inundation_ha: "Genangan baru",
  existing_water_ha: "Air sebelumnya", receded_water_ha: "Air surut", flooded_area_ha: "Total air terdeteksi",
  buildings_exposed: "Bangunan terpapar", building_count_in_aoi: "Footprint bangunan dalam AOI",
  exposed_building_footprint_area_ha: "Luas footprint terpapar", exposed_building_pct: "Bangunan terpapar",
  road_segments_exposed: "Segmen jalan terpapar", road_length_exposed_m: "Panjang jalan terpapar", road_length_exposed_km: "Panjang jalan terpapar",
  candidate_building_count: "Kandidat bangunan", candidate_footprint_area_ha: "Luas footprint kandidat",
};

export function statisticMetric(key: string): { label: string; unit: string } | null {
  if (["threshold", "cache_key", "pre_band", "post_band"].includes(key)) return null;
  const unit = key.endsWith("_ha") ? "ha" : key.endsWith("_km") ? "km" : key.endsWith("_m") ? "m" : key.endsWith("_pct") || key.endsWith("_percentage") ? "%"
    : /count|buildings|segments/.test(key) ? "objek" : "";
  return { label: LABELS[key] ?? key.replace(/_(ha|km|m|pct)$/, "").split("_").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" "), unit };
}

export function formatStatistic(key: string, value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Belum tersedia";
  const metric = statisticMetric(key);
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${metric?.unit ? ` ${metric.unit}` : ""}`;
}
