import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(process.cwd(), process.argv[2] || "public/build-metadata.json");
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function integer(value) {
  const normalized = text(value);
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

const workflowRunId = integer(process.env.GITHUB_RUN_ID);
const repository = text(process.env.GITHUB_REPOSITORY);
const serverUrl = text(process.env.GITHUB_SERVER_URL) || "https://github.com";
const metadata = {
  schema_version: 1,
  component: "frontend",
  product_version: packageJson.version,
  component_version: packageJson.version,
  build_number: integer(process.env.GITHUB_RUN_NUMBER),
  run_attempt: integer(process.env.GITHUB_RUN_ATTEMPT),
  commit_sha: text(process.env.GITHUB_SHA),
  ref: text(process.env.GITHUB_REF),
  build_time_utc: text(process.env.SAVEGEO_BUILD_TIME_UTC) || new Date().toISOString(),
  deployed_at_utc: text(process.env.SAVEGEO_DEPLOYED_AT_UTC),
  workflow_name: text(process.env.GITHUB_WORKFLOW),
  workflow_run_id: workflowRunId,
  workflow_run_url: workflowRunId && repository ? `${serverUrl}/${repository}/actions/runs/${workflowRunId}` : null,
  deployment_environment: text(process.env.SAVEGEO_DEPLOYMENT_ENVIRONMENT),
  metadata_source: process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
};

if (!/^\d+\.\d+\.\d+$/.test(metadata.product_version)) {
  throw new Error(`package.json version must be SemVer, got ${metadata.product_version}`);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Wrote SAVEGEO frontend build metadata to ${output}`);
