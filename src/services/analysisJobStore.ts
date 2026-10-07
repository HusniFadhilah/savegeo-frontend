import { create } from "zustand";
export interface AnalysisJobRecord {
  job_id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error?: string;
}
export const useAnalysisJobStore = create<{
  jobs: AnalysisJobRecord[];
  update: (job: AnalysisJobRecord) => void;
}>((set) => ({
  jobs: [],
  update: (job) =>
    set((state) => ({
      jobs: [...state.jobs.filter((j) => j.job_id !== job.job_id), job].slice(-20),
    })),
}));
