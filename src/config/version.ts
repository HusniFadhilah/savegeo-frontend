import packageJson from "../../package.json";

export interface BuildMetadata {
  schema_version: 1;
  component: "frontend" | "backend";
  product_version: string;
  component_version: string;
  build_number: number | null;
  run_attempt: number | null;
  commit_sha: string | null;
  ref: string | null;
  build_time_utc: string | null;
  deployed_at_utc: string | null;
  workflow_name: string | null;
  workflow_run_id: number | null;
  workflow_run_url: string | null;
  deployment_environment: string | null;
  metadata_source?: string;
}

export const frontendPackageVersion = packageJson.version;

export const localFrontendMetadata: BuildMetadata = {
  schema_version: 1,
  component: "frontend",
  product_version: frontendPackageVersion,
  component_version: frontendPackageVersion,
  build_number: null,
  run_attempt: null,
  commit_sha: null,
  ref: null,
  build_time_utc: null,
  deployed_at_utc: null,
  workflow_name: null,
  workflow_run_id: null,
  workflow_run_url: null,
  deployment_environment: "local",
  metadata_source: "local",
};

export function isBuildMetadata(value: unknown): value is BuildMetadata {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<BuildMetadata>;
  return metadata.schema_version === 1 && (metadata.component === "frontend" || metadata.component === "backend") && typeof metadata.product_version === "string" && typeof metadata.component_version === "string";
}

export async function fetchFrontendBuildMetadata(): Promise<BuildMetadata> {
  const response = await fetch("/build-metadata.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Frontend metadata request failed: ${response.status}`);
  const data: unknown = await response.json();
  if (!isBuildMetadata(data) || data.component !== "frontend") throw new Error("Invalid frontend build metadata");
  return data;
}

export function getCompatibilityStatus(frontend: BuildMetadata | null, backend: BuildMetadata | null): "compatible" | "different" | "metadata_unavailable" {
  if (!frontend || !backend) return "metadata_unavailable";
  return frontend.product_version === backend.product_version ? "compatible" : "different";
}

export function shortCommit(commitSha: string | null | undefined): string {
  return commitSha ? commitSha.slice(0, 7) : "—";
}

export function buildLabel(metadata: BuildMetadata | null): string {
  if (!metadata) return "metadata tidak tersedia";
  return metadata.build_number === null ? "local" : `build ${metadata.build_number}`;
}
