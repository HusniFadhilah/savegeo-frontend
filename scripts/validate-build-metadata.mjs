import { readFile } from "node:fs/promises";

const [file, ...args] = process.argv.slice(2);
if (!file) throw new Error("Usage: node validate-build-metadata.mjs <file> [--expected-environment <name>]");

function flag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const metadata = JSON.parse(await readFile(file, "utf8"));
const required = ["schema_version", "component", "product_version", "component_version", "build_time_utc"];
for (const key of required) {
  if (metadata[key] === undefined || metadata[key] === null || metadata[key] === "") throw new Error(`Missing required metadata field: ${key}`);
}
if (metadata.schema_version !== 1 || metadata.component !== "frontend") throw new Error("Unsupported frontend build metadata schema/component");
if (!/^\d+\.\d+\.\d+$/.test(metadata.product_version) || metadata.component_version !== metadata.product_version) throw new Error("Frontend metadata contains an invalid or inconsistent SemVer");
if (metadata.commit_sha !== null && metadata.commit_sha !== undefined && !/^[0-9a-f]{40}$/i.test(metadata.commit_sha)) throw new Error("commit_sha must be a full 40-character SHA or null");
if (process.env.GITHUB_SHA && metadata.commit_sha !== process.env.GITHUB_SHA) throw new Error(`Metadata commit ${metadata.commit_sha} does not match GITHUB_SHA ${process.env.GITHUB_SHA}`);
const expectedSha = flag("--expected-sha");
if (expectedSha && metadata.commit_sha !== expectedSha) throw new Error(`Metadata commit ${metadata.commit_sha} does not match expected SHA ${expectedSha}`);
const expectedEnvironment = flag("--expected-environment");
if (expectedEnvironment && metadata.deployment_environment !== expectedEnvironment) throw new Error(`Metadata environment ${metadata.deployment_environment} does not match ${expectedEnvironment}`);
const forbidden = /(secret|token|password|credential|private[_-]?key|api[_-]?key)/i;
if (Object.keys(metadata).some((key) => forbidden.test(key))) throw new Error("Build metadata contains a forbidden secret-like field name");
console.log(`Validated SAVEGEO frontend metadata: ${metadata.product_version}, build ${metadata.build_number ?? "local"}`);
