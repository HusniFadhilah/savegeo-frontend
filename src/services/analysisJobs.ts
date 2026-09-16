import { apiClient, ApiError } from "@/services/apiClient";

type AnalysisJobStatus = "queued" | "running" | "succeeded" | "failed";

interface CreateJobResponse {
  job_id: string;
  status: AnalysisJobStatus;
  status_url: string;
}

interface JobStatusResponse<T> {
  job_id: string;
  type: string;
  status: AnalysisJobStatus;
  result?: T;
  error?: string;
  http_status?: number;
}

interface RunJobOptions {
  timeoutMs: number;
  pollIntervalMs?: number;
}

const JOB_REQUEST_TIMEOUT_MS = 30_000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAnalysisJob<T>(
  type:
    | "carbon"
    | "carbon_local"
    | "carbon_delta"
    | "geotiff"
    | "vegetation"
    | "landcover"
    | "landcover_transition"
    | "landcover_change_map"
    | "landcover_hotspots"
    | "crop_monitoring",
  payload: unknown,
  options: RunJobOptions,
): Promise<T> {
  const started = Date.now();
  const pollIntervalMs = options.pollIntervalMs ?? 3_000;
  const job = await apiClient.post<CreateJobResponse>(
    "/analysis-jobs",
    { type, payload },
    { timeoutMs: JOB_REQUEST_TIMEOUT_MS, auth: "app" },
  );

  while (Date.now() - started < options.timeoutMs) {
    await wait(pollIntervalMs);
    const status = await apiClient.get<JobStatusResponse<T>>(
      job.status_url,
      { timeoutMs: JOB_REQUEST_TIMEOUT_MS, auth: "app" },
    );
    if (status.status === "succeeded" && status.result !== undefined) return status.result;
    if (status.status === "failed") {
      throw new ApiError(status.error || "Analysis job failed", status.http_status || 500, status);
    }
  }

  throw new ApiError("Request timed out", 0, { job_id: job.job_id, type });
}
