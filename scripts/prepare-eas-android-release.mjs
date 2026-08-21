import { createWriteStream } from "node:fs";
import { open, readFile, rm, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const [buildJsonPath, expectedCommit, apkPath, releaseJsonPath] =
  process.argv.slice(2);
if (!buildJsonPath || !expectedCommit || !apkPath || !releaseJsonPath) {
  throw new Error(
    "Usage: prepare-eas-android-release.mjs <build-json> <commit> <apk> <release-json>",
  );
}

const build = JSON.parse(await readFile(buildJsonPath, "utf8"));
if (!build || Array.isArray(build) || typeof build !== "object") {
  throw new Error("EAS build metadata must be one JSON object.");
}
if (build.status !== "FINISHED") {
  throw new Error(
    `EAS build did not finish successfully (${build.status ?? "unknown"}).`,
  );
}
if (build.platform !== "ANDROID" || build.buildProfile !== "preview") {
  throw new Error("EAS returned metadata for an unexpected build target.");
}
if (
  typeof build.gitCommitHash !== "string" ||
  build.gitCommitHash.toLowerCase() !== expectedCommit.toLowerCase()
) {
  throw new Error(
    "EAS build commit does not match the GitHub workflow commit.",
  );
}
if (
  typeof build.id !== "string" ||
  !/^[0-9A-Za-z][0-9A-Za-z_-]{5,127}$/.test(build.id)
) {
  throw new Error("EAS returned an invalid build ID.");
}
if (
  typeof build.appVersion !== "string" ||
  !/^[0-9A-Za-z][0-9A-Za-z._+-]{0,49}$/.test(build.appVersion)
) {
  throw new Error("EAS returned an invalid Android version.");
}
const versionCode = Number(build.appBuildVersion);
if (
  !Number.isSafeInteger(versionCode) ||
  versionCode < 1 ||
  versionCode > 2_147_483_647
) {
  throw new Error("EAS returned an invalid Android versionCode.");
}

const artifactUrl = build.artifacts?.applicationArchiveUrl;
if (
  typeof artifactUrl !== "string" ||
  new URL(artifactUrl).protocol !== "https:"
) {
  throw new Error("EAS did not return an HTTPS APK artifact URL.");
}

const response = await fetch(artifactUrl, {
  redirect: "follow",
  signal: AbortSignal.timeout(10 * 60 * 1000),
});
if (!response.ok || !response.body) {
  throw new Error(`Could not download the EAS APK (HTTP ${response.status}).`);
}
if (new URL(response.url).protocol !== "https:") {
  throw new Error("EAS APK download redirected away from HTTPS.");
}
const contentLength = Number(response.headers.get("content-length") ?? 0);
const maximumSize = 200 * 1024 * 1024;
if (Number.isFinite(contentLength) && contentLength > maximumSize) {
  throw new Error("EAS APK exceeds the configured 200 MB limit.");
}

let downloaded = 0;
const sizeGuard = new Transform({
  transform(chunk, _encoding, callback) {
    downloaded += chunk.length;
    callback(
      downloaded > maximumSize
        ? new Error("EAS APK exceeds the configured 200 MB limit.")
        : null,
      chunk,
    );
  },
});

try {
  await pipeline(
    Readable.fromWeb(response.body),
    sizeGuard,
    createWriteStream(apkPath, { flags: "wx" }),
  );
  const signature = Buffer.alloc(4);
  const apk = await open(apkPath, "r");
  try {
    await apk.read(signature, 0, 4, 0);
  } finally {
    await apk.close();
  }
  if (
    !["504b0304", "504b0506", "504b0708"].includes(signature.toString("hex"))
  ) {
    throw new Error("Downloaded EAS artifact is not an APK/ZIP archive.");
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const dispositionFilename = disposition.match(
    /filename\*?=(?:UTF-8''|\")?([^";]+)/i,
  )?.[1];
  const urlFilename = basename(
    decodeURIComponent(new URL(response.url).pathname),
  );
  const candidateFilename = dispositionFilename
    ? decodeURIComponent(dispositionFilename.trim())
    : urlFilename;
  const originalFilename = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,179}\.apk$/i.test(
    candidateFilename,
  )
    ? candidateFilename
    : `eas-android-${build.id}.apk`;
  const builtAt = new Date(build.completedAt ?? build.updatedAt);
  if (Number.isNaN(builtAt.getTime())) {
    throw new Error("EAS returned an invalid build completion timestamp.");
  }

  await writeFile(
    releaseJsonPath,
    `${JSON.stringify(
      {
        version: build.appVersion,
        versionCode,
        builtAt: builtAt.toISOString(),
        commit: build.gitCommitHash.toLowerCase(),
        easBuildId: build.id,
        originalFilename,
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", flag: "wx" },
  );
} catch (error) {
  await Promise.all([
    rm(apkPath, { force: true }).catch(() => undefined),
    rm(releaseJsonPath, { force: true }).catch(() => undefined),
  ]);
  throw error;
}
