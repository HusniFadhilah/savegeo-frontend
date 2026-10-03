import { apiClient } from "@/services/apiClient";
import { isBuildMetadata, type BuildMetadata } from "@/config/version";

export async function fetchBackendVersion(): Promise<BuildMetadata> {
  const metadata = await apiClient.get<BuildMetadata>("/version");
  if (!isBuildMetadata(metadata) || metadata.component !== "backend") throw new Error("Invalid backend build metadata");
  return metadata;
}
