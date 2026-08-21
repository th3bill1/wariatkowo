import express from "express";
import { request as httpRequest, type Server } from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApplicationSession } from "../server/_shared/auth";
import type { Env } from "../server/_shared/http";
import { applyMigrations } from "../server/db/migrations";
import { SqliteDatabase } from "../server/db/database";
import type { MobileReleaseConfig } from "../server/mobileRelease/config";
import { createMobileReleaseRouter } from "../server/mobileRelease/router";
import { MobileReleaseStorage } from "../server/mobileRelease/storage";
import { MobileReleaseDownloadContent } from "../src/components/MobileReleaseDownload";
import { hasNewerAndroidRelease } from "../shared/mobileRelease";

const DEPLOY_TOKEN = "test-deploy-token-that-is-long-and-private";
const COMMIT = "a".repeat(40);
const EAS_BUILD_ID = "eas-build-0001";
const BUILT_AT = "2026-08-19T09:40:00.000Z";

function apkBlob(contents = "valid-apk-payload"): Blob {
  return new Blob(
    [
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      `AndroidManifest.xml${contents}`,
    ],
    { type: "application/vnd.android.package-archive" },
  );
}

function uploadForm(versionCode: number, apk: Blob = apkBlob()): FormData {
  const form = new FormData();
  form.set("version", `1.4.${versionCode}`);
  form.set("versionCode", String(versionCode));
  form.set("builtAt", BUILT_AT);
  form.set("commit", COMMIT);
  form.set("easBuildId", `${EAS_BUILD_ID}-${versionCode}`);
  form.set("apk", apk, `original-${versionCode}.apk`);
  return form;
}

describe("Android mobile releases", () => {
  let database: SqliteDatabase;
  let env: Env;
  let storage: MobileReleaseStorage;
  let rootPath: string;
  let server: Server;
  let origin: string;
  let sessionToken: string;

  beforeEach(async () => {
    database = new SqliteDatabase(":memory:");
    applyMigrations(database.raw);
    env = { DB: database, COOKIE_SECURE: false };
    rootPath = await mkdtemp(join(tmpdir(), "wariatkowo-mobile-release-"));
    storage = new MobileReleaseStorage(rootPath, 5);
    await storage.initialize();
    const config: MobileReleaseConfig = {
      rootPath,
      deployToken: DEPLOY_TOKEN,
      maxFileSizeBytes: 1024 * 1024,
      retentionCount: 5,
      rateLimitWindowMs: 60_000,
      rateLimitMax: 20,
      requireHttps: false,
    };
    const app = express();
    app.use(createMobileReleaseRouter({ env, storage, config }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not expose a TCP port.");
    }
    origin = `http://127.0.0.1:${address.port}`;
    sessionToken = (
      await createApplicationSession(env, {
        id: "member-misiek",
        name: "Misiek",
        slug: "misiek",
      })
    ).token;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    database.close();
    await rm(rootPath, { recursive: true, force: true });
  });

  async function upload(
    versionCode: number,
    token = DEPLOY_TOKEN,
    apk = apkBlob(),
  ) {
    return fetch(`${origin}/api/internal/mobile-release`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm(versionCode, apk),
    });
  }

  async function interruptUpload(): Promise<void> {
    const boundary = "wariatkowo-interrupted-upload";
    const target = new URL("/api/internal/mobile-release", origin);
    const body = [
      `--${boundary}\r\nContent-Disposition: form-data; name="version"\r\n\r\n9.9.9\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="versionCode"\r\n\r\n999\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="builtAt"\r\n\r\n${BUILT_AT}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="commit"\r\n\r\n${COMMIT}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="easBuildId"\r\n\r\ninterrupted-build\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="apk"; filename="partial.apk"\r\nContent-Type: application/vnd.android.package-archive\r\n\r\nPK\u0003\u0004AndroidManifest.xml`,
    ].join("");

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const request = httpRequest({
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEPLOY_TOKEN}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": Buffer.byteLength(body) + 10_000,
        },
      });
      request.once("error", finish);
      request.once("close", finish);
      request.write(body);
      setTimeout(() => request.destroy(), 10);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  it("rejects missing and invalid deployment authentication", async () => {
    const missing = await fetch(`${origin}/api/internal/mobile-release`, {
      method: "POST",
    });
    const invalid = await upload(18, "incorrect-token");

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it("accepts a valid APK and validated release metadata", async () => {
    const response = await upload(18);

    expect(response.status, await response.clone().text()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        available: true,
        version: "1.4.18",
        versionCode: 18,
        commit: COMMIT,
        downloadUrl: "/api/mobile/download",
      },
    });
    await expect(storage.readLatest()).resolves.toMatchObject({
      versionCode: 18,
      originalFilename: "original-18.apk",
      easBuildId: `${EAS_BUILD_ID}-18`,
    });
  });

  it("rejects non-APK files and invalid metadata", async () => {
    const invalidFile = new Blob(["not an apk"], {
      type: "application/vnd.android.package-archive",
    });
    const fileResponse = await upload(18, DEPLOY_TOKEN, invalidFile);

    const form = uploadForm(19);
    form.set("versionCode", "not-a-number");
    const metadataResponse = await fetch(
      `${origin}/api/internal/mobile-release`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${DEPLOY_TOKEN}` },
        body: form,
      },
    );

    expect(fileResponse.status).toBe(400);
    expect(metadataResponse.status).toBe(400);
    await expect(storage.readLatest()).resolves.toBeNull();
  });

  it("does not let an older versionCode replace the latest release", async () => {
    expect((await upload(25)).status).toBe(201);
    const older = await upload(24);

    expect(older.status).toBe(409);
    await expect(storage.readLatest()).resolves.toMatchObject({
      versionCode: 25,
    });
  });

  it("serializes concurrent uploads without corrupting release state", async () => {
    const [first, second] = await Promise.all([upload(30), upload(31)]);

    expect(
      [first.status, second.status].every((status) =>
        [201, 409].includes(status),
      ),
    ).toBe(true);
    await expect(storage.readLatest()).resolves.toMatchObject({
      versionCode: 31,
    });
  });

  it("retains only the configured release history", async () => {
    for (let versionCode = 10; versionCode <= 16; versionCode += 1) {
      expect((await upload(versionCode)).status).toBe(201);
    }

    const history = await readdir(storage.releasesPath);
    expect(history).toHaveLength(5);
    expect(history).toContain("wariatkowo-1.4.16-16.apk");
    expect(history).not.toContain("wariatkowo-1.4.10-10.apk");
  });

  it("keeps the working release when an upload is left incomplete", async () => {
    expect((await upload(25)).status).toBe(201);
    await interruptUpload();

    await expect(storage.readLatest()).resolves.toMatchObject({
      versionCode: 25,
    });
    await expect(readdir(storage.temporaryPath)).resolves.toEqual([]);
    const authenticatedDownload = await fetch(`${origin}/api/mobile/download`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    expect(authenticatedDownload.status).toBe(200);
  });

  it("handles missing releases and protects metadata and downloads", async () => {
    const missingLatest = await fetch(`${origin}/api/mobile/latest`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const missingDownload = await fetch(`${origin}/api/mobile/download`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const unauthenticatedLatest = await fetch(`${origin}/api/mobile/latest`);
    const unauthenticatedDownload = await fetch(
      `${origin}/api/mobile/download`,
    );

    expect(missingLatest.status).toBe(200);
    await expect(missingLatest.json()).resolves.toEqual({
      data: { available: false },
    });
    expect(missingDownload.status).toBe(404);
    expect(unauthenticatedLatest.status).toBe(401);
    expect(unauthenticatedDownload.status).toBe(401);
  });

  it("returns latest metadata and streams the authenticated APK", async () => {
    expect((await upload(18)).status).toBe(201);
    const headers = { Authorization: `Bearer ${sessionToken}` };
    const latest = await fetch(`${origin}/api/mobile/latest`, { headers });
    const download = await fetch(`${origin}/api/mobile/download`, { headers });

    expect(latest.status).toBe(200);
    await expect(latest.json()).resolves.toMatchObject({
      data: { available: true, versionCode: 18 },
    });
    expect(download.status).toBe(200);
    expect(download.headers.get("Content-Type")).toBe(
      "application/vnd.android.package-archive",
    );
    expect(download.headers.get("Content-Disposition")).toContain(
      "wariatkowo-android-1.4.18-18.apk",
    );
    expect(new Uint8Array(await download.arrayBuffer()).slice(0, 4)).toEqual(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    );
  });
});

describe("mobile release clients", () => {
  const release = {
    available: true as const,
    version: "1.4.2",
    versionCode: 18,
    builtAt: BUILT_AT,
    commit: COMMIT,
    downloadUrl: "/api/mobile/download" as const,
  };

  it("renders the dashboard download only when a release exists", () => {
    const available = renderToStaticMarkup(
      <MobileReleaseDownloadContent release={release} />,
    );
    const missing = renderToStaticMarkup(
      <MobileReleaseDownloadContent release={{ available: false }} />,
    );

    expect(available).toContain("Wariatkowo na Androida");
    expect(available).toContain("v1.4.2 · build 18");
    expect(available).toContain('href="/api/mobile/download"');
    expect(missing).toBe("");
  });

  it("compares native Android versionCode values", () => {
    expect(hasNewerAndroidRelease("17", release)).toBe(true);
    expect(hasNewerAndroidRelease(18, release)).toBe(false);
    expect(hasNewerAndroidRelease(19, release)).toBe(false);
    expect(hasNewerAndroidRelease(null, release)).toBe(false);
    expect(hasNewerAndroidRelease(17, { available: false })).toBe(false);
  });
});
