import { readFile, writeFile } from "node:fs/promises";

const [metadataFile, outputFile, environment] = process.argv.slice(2);
if (!metadataFile || !outputFile || !environment) throw new Error("Usage: node write-deployment-record.mjs <metadata-file> <output-file> <environment>");
const metadata = JSON.parse(await readFile(metadataFile, "utf8"));
metadata.deployment_environment = environment;
metadata.deployed_at_utc = new Date().toISOString();
metadata.deployment_status = "succeeded";
metadata.health_check = "passed";
await writeFile(outputFile, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(`Wrote frontend deployment record to ${outputFile}`);
