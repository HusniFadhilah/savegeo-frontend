import { apiClient } from "@/services/apiClient";

export type Pool = "agb" | "bgb" | "soc" | "litter" | "deadwood";
export const FIELD_REFERENCE_LABELS: Record<string, string> = {
  field_measurement: "Pengukuran langsung",
  laboratory: "Laboratorium",
  allometry: "Allometri",
  root_shoot_ratio: "Rasio akar:tajuk",
};
export const FIELD_EXCLUSION_LABELS: Record<string, string> = {
  prediction_missing_or_ambiguous: "Prediksi sumber belum tersedia atau ambigu",
  year_mismatch: "Tahun prediksi tidak sesuai tanggal survei",
  point_pixel_support_not_accepted: "Prediksi satu piksel belum diizinkan",
  soil_depth_mismatch: "Kedalaman SOC lapangan dan prediksi berbeda",
};
export function fieldPoolLabel(value: string) {
  return (
    (
      {
        agb: "AGB",
        aboveground_biomass_carbon: "AGB",
        bgb: "BGB",
        belowground_biomass_carbon: "BGB",
        soc: "SOC",
        soil_organic_carbon: "SOC",
        litter: "Litter / serasah",
        litter_carbon: "Litter / serasah",
        deadwood: "Deadwood / kayu mati",
        deadwood_carbon: "Deadwood / kayu mati",
      } as Record<string, string>
    )[value] ?? value
  );
}
export const FIELD_POOLS: { value: Pool; label: string }[] = [
  { value: "agb", label: "AGB" },
  { value: "bgb", label: "BGB" },
  { value: "soc", label: "SOC" },
  { value: "litter", label: "Litter / serasah" },
  { value: "deadwood", label: "Deadwood / kayu mati" },
];
export interface FieldInventory {
  total_records: number;
  pools: Record<
    Pool,
    {
      records: number;
      calibration_plots: number;
      validation_plots: number;
      without_prediction: number;
      sources: string[];
    }
  >;
}
export interface FieldObservation {
  id: string;
  pool: Pool;
  role: "calibration" | "validation";
  observed_mg_c_ha: number;
  raw: {
    plot_id: string;
    survey_date: string;
    source: string;
    reference_type: string;
    depth_top_cm?: number;
    depth_bottom_cm?: number;
  };
  predictions: {
    source: string;
    value_mg_c_ha: number;
    year: number;
    scale_m: number;
    support: string;
  }[];
}
export interface CsvPreview {
  valid: boolean;
  preview: {
    row: number;
    plot_id: string;
    pool: string;
    role: string;
    observed_mg_c_ha: number;
    warnings: string[];
  }[];
  errors: { row: number; message: string }[];
}
export interface Metric {
  status: string;
  n_plots?: number;
  rmse?: number;
  mae?: number;
  bias?: number;
  r2?: number | null;
  reason?: string;
  rows?: { plot_id: string; observed: number; predicted: number }[];
}
export interface Assessment {
  id: string;
  target_pool?: string;
  metrics: {
    configuration?: { pool: Pool; prediction_source: string };
    status: string;
    calibration_plots: number;
    validation_plots: number;
    matched_records: number;
    baseline_calibration: Metric;
    baseline_validation: Metric;
    cross_validation: Metric;
    calibrated_validation?: Metric;
    excluded: { id: string; plot_id: string; reason: string }[];
    warnings: string[];
    method_note: string;
    artifact?: { slope: number; intercept: number; clip_min?: number } | null;
  };
}
const base = "/admin/carbon-calibration";
export const fieldApi = {
  summary: (dataset: string) =>
    apiClient.get<FieldInventory>(`${base}/datasets/${encodeURIComponent(dataset)}/field-summary`, {
      auth: true,
    }),
  history: (dataset: string) =>
    apiClient.get<{
      runs: { id: string; target_pool: string; status: string; created_at: string }[];
    }>(`${base}/datasets/${encodeURIComponent(dataset)}/field-assessments`, { auth: true }),
  assessment: (id: string) =>
    apiClient.get<Assessment>(`${base}/runs/${encodeURIComponent(id)}`, { auth: true }),
  list: (dataset: string, page = 1, pool?: Pool) =>
    apiClient.get<{ rows: FieldObservation[]; total: number; page: number; page_size: number }>(
      `${base}/datasets/${encodeURIComponent(dataset)}/observations?page=${page}${pool ? `&pool=${pool}` : ""}`,
      { auth: true },
    ),
  add: (dataset: string, record: Record<string, unknown>) =>
    apiClient.post(
      `${base}/datasets/${encodeURIComponent(dataset)}/observations`,
      { records: [record] },
      { auth: true },
    ),
  csv: (dataset: string, file: File, preview: boolean) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.upload<CsvPreview>(
      `${base}/datasets/${encodeURIComponent(dataset)}/observations/csv?preview=${preview}`,
      form,
      { auth: true },
    );
  },
  assess: (dataset: string, payload: Record<string, unknown>) =>
    apiClient.post<Assessment>(
      `${base}/datasets/${encodeURIComponent(dataset)}/field-assessments`,
      payload,
      { auth: true },
    ),
  prediction: (dataset: string, id: string, payload: Record<string, unknown>) =>
    apiClient.post(
      `${base}/datasets/${encodeURIComponent(dataset)}/observations/${encodeURIComponent(id)}/predictions`,
      payload,
      { auth: true },
    ),
};

export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const FIELD_CSV_HEADER =
  "plot_id,survey_date,pool,role,latitude,longitude,plot_area_m2,reference_type,method,source,quantity,unit,value,carbon_fraction,depth_top_cm,depth_bottom_cm,soil_layers_json,litter_sample_json,deadwood_sample_json,prediction_source,prediction_year,prediction_mg_c_ha,prediction_scale_m,prediction_support,prediction_depth_top_cm,prediction_depth_bottom_cm";
