import { apiClient } from "@/services/apiClient";
import type { LandCoverDatasetOption } from "@/features/landcover/types";

export type LandCoverModelConfig = Record<string, Record<string, unknown>>;
export interface TrainingJob {
  job_id?: string; status: "queued" | "sampling" | "exporting" | "completed" | "failed";
  model: string; task_id?: string; asset_id?: string; error?: string;
  config_entry?: Record<string, unknown>;
  training_metadata?: { training_sample_count: number; missing_training_classes: number[]; quality_note: string };
}
export const fetchLandCoverModels = () => apiClient.get<{ config: LandCoverModelConfig; models: LandCoverDatasetOption[] }>("/admin/landcover-models", { auth: true });
export const saveLandCoverModels = (config: LandCoverModelConfig) => apiClient.put<{ config: LandCoverModelConfig }>("/admin/landcover-models", config, { auth: true });
export const trainLandCoverModel = (body: { model: string; asset_id: string; model_version: string; aoi?: { geojson: GeoJSON.GeoJSON } }) =>
  apiClient.post<{ job_id: string; status: "queued" }>("/admin/landcover-models/train", body, { auth: true });
export const fetchLandCoverTraining = (id: string) => apiClient.get<TrainingJob>(`/admin/landcover-models/training/${id}`, { auth: true });
