import { readFile } from "node:fs/promises";

const [metadataPath] = process.argv.slice(2);
if (!metadataPath) throw new Error("Usage: read-eas-build-id.mjs <build-json>");

const parsed = JSON.parse(await readFile(metadataPath, "utf8"));
const builds = Array.isArray(parsed) ? parsed : [parsed];
if (builds.length !== 1 || typeof builds[0]?.id !== "string") {
  throw new Error("EAS did not return exactly one Android build ID.");
}
if (!/^[0-9A-Za-z][0-9A-Za-z_-]{5,127}$/.test(builds[0].id)) {
  throw new Error("EAS returned an invalid build ID.");
}

process.stdout.write(builds[0].id);
