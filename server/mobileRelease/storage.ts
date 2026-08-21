import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { MobileReleaseStatus } from "../../shared/models";

export type IncomingMobileRelease = {
  version: string;
  versionCode: number;
  builtAt: string;
  commit: string;
  easBuildId: string;
  originalFilename: string;
};

export type StoredMobileRelease = IncomingMobileRelease & {
  filename: string;
  storedFilename: string;
  size: number;
  uploadedAt: string;
};

export class MobileReleaseValidationError extends Error {}
export class MobileReleaseConflictError extends Error {}

const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,49}$/;
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;
const EAS_BUILD_ID_PATTERN = /^[0-9A-Za-z][0-9A-Za-z_-]{5,127}$/;
const ORIGINAL_FILENAME_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,179}\.apk$/i;
const STORED_FILENAME_PATTERN =
  /^wariatkowo-[0-9A-Za-z._+-]+-[1-9][0-9]*\.apk$/;
const APK_SIGNATURES = new Set(["504b0304", "504b0506", "504b0708"]);
const APK_REQUIRED_ENTRY = Buffer.from("AndroidManifest.xml", "ascii");

function isInside(parent: string, candidate: string): boolean {
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return candidate.startsWith(prefix);
}

function validateOriginalFilename(filename: string): boolean {
  return (
    filename.length > 0 &&
    filename.length <= 200 &&
    filename === basename(filename) &&
    !filename.includes("\0") &&
    extname(filename).toLowerCase() === ".apk" &&
    ORIGINAL_FILENAME_PATTERN.test(filename)
  );
}

export function validateReleaseMetadata(
  value: IncomingMobileRelease,
): IncomingMobileRelease {
  if (!VERSION_PATTERN.test(value.version)) {
    throw new MobileReleaseValidationError("Invalid Android version.");
  }
  if (
    !Number.isSafeInteger(value.versionCode) ||
    value.versionCode < 1 ||
    value.versionCode > 2_147_483_647
  ) {
    throw new MobileReleaseValidationError("Invalid Android versionCode.");
  }
  const builtAt = new Date(value.builtAt);
  if (Number.isNaN(builtAt.getTime())) {
    throw new MobileReleaseValidationError("Invalid build timestamp.");
  }
  if (!COMMIT_PATTERN.test(value.commit)) {
    throw new MobileReleaseValidationError("Invalid git commit SHA.");
  }
  if (!EAS_BUILD_ID_PATTERN.test(value.easBuildId)) {
    throw new MobileReleaseValidationError("Invalid EAS build ID.");
  }
  if (!validateOriginalFilename(value.originalFilename)) {
    throw new MobileReleaseValidationError("Invalid APK filename.");
  }

  return {
    version: value.version,
    versionCode: value.versionCode,
    builtAt: builtAt.toISOString(),
    commit: value.commit.toLowerCase(),
    easBuildId: value.easBuildId,
    originalFilename: value.originalFilename,
  };
}

function parseStoredRelease(value: unknown): StoredMobileRelease | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredMobileRelease>;
  try {
    const metadata = validateReleaseMetadata({
      version: candidate.version ?? "",
      versionCode: candidate.versionCode ?? Number.NaN,
      builtAt: candidate.builtAt ?? "",
      commit: candidate.commit ?? "",
      easBuildId: candidate.easBuildId ?? "",
      originalFilename: candidate.originalFilename ?? "",
    });
    if (
      typeof candidate.filename !== "string" ||
      !validateOriginalFilename(candidate.filename) ||
      typeof candidate.storedFilename !== "string" ||
      !STORED_FILENAME_PATTERN.test(candidate.storedFilename) ||
      candidate.storedFilename !== basename(candidate.storedFilename) ||
      typeof candidate.size !== "number" ||
      !Number.isSafeInteger(candidate.size) ||
      candidate.size < 1 ||
      typeof candidate.uploadedAt !== "string" ||
      Number.isNaN(Date.parse(candidate.uploadedAt))
    ) {
      return null;
    }
    return {
      ...metadata,
      filename: candidate.filename,
      storedFilename: candidate.storedFilename,
      size: candidate.size,
      uploadedAt: new Date(candidate.uploadedAt).toISOString(),
    };
  } catch {
    return null;
  }
}

export function publicReleaseStatus(
  release: StoredMobileRelease | null,
): MobileReleaseStatus {
  return release
    ? {
        available: true,
        version: release.version,
        versionCode: release.versionCode,
        builtAt: release.builtAt,
        commit: release.commit,
        downloadUrl: "/api/mobile/download",
      }
    : { available: false };
}

export class MobileReleaseStorage {
  readonly releasesPath: string;
  readonly temporaryPath: string;
  readonly latestApkPath: string;
  readonly latestMetadataPath: string;
  private operation = Promise.resolve();
  private initialization: Promise<void> | null = null;

  constructor(
    readonly rootPath: string,
    private readonly retentionCount: number,
  ) {
    this.rootPath = resolve(rootPath);
    this.releasesPath = join(this.rootPath, "releases");
    this.temporaryPath = join(this.rootPath, ".tmp");
    this.latestApkPath = join(this.rootPath, "wariatkowo-latest.apk");
    this.latestMetadataPath = join(this.rootPath, "latest.json");
  }

  async initialize(): Promise<void> {
    this.initialization ??= this.initializeOnce();
    await this.initialization;
  }

  private async initializeOnce(): Promise<void> {
    await Promise.all([
      mkdir(this.releasesPath, { recursive: true }),
      mkdir(this.temporaryPath, { recursive: true }),
    ]);
    const temporaryEntries = await readdir(this.temporaryPath, {
      withFileTypes: true,
    });
    await Promise.all(
      temporaryEntries
        .filter(
          (entry) =>
            entry.isFile() &&
            (/^upload-[0-9a-f-]+\.part$/i.test(entry.name) ||
              /^latest-[0-9a-f-]+\.(?:apk|json)$/i.test(entry.name)),
        )
        .map((entry) =>
          rm(join(this.temporaryPath, entry.name), { force: true }),
        ),
    );
  }

  async createTemporaryUploadPath(): Promise<string> {
    await this.initialize();
    return join(this.temporaryPath, `upload-${randomUUID()}.part`);
  }

  async discardTemporaryUpload(path: string | null): Promise<void> {
    if (!path) return;
    const resolvedPath = resolve(path);
    if (!isInside(this.temporaryPath, resolvedPath)) return;
    await rm(resolvedPath, { force: true }).catch(() => undefined);
  }

  async inspectApk(path: string, maximumSize: number): Promise<number> {
    const details = await stat(path);
    if (!details.isFile() || details.size < 4 || details.size > maximumSize) {
      throw new MobileReleaseValidationError("Invalid APK file size.");
    }
    const stream = createReadStream(path);
    let prefix = Buffer.alloc(0);
    let carry = Buffer.alloc(0);
    let containsAndroidManifest = false;
    for await (const chunk of stream) {
      const bytes = Buffer.from(chunk);
      if (prefix.length < 4) {
        prefix = Buffer.concat([prefix, bytes]).subarray(0, 4);
      }
      const searchable = Buffer.concat([carry, bytes]);
      if (searchable.includes(APK_REQUIRED_ENTRY))
        containsAndroidManifest = true;
      carry = searchable.subarray(
        Math.max(0, searchable.length - APK_REQUIRED_ENTRY.length + 1),
      );
    }
    if (
      !APK_SIGNATURES.has(prefix.toString("hex")) ||
      !containsAndroidManifest
    ) {
      throw new MobileReleaseValidationError("Uploaded file is not an APK.");
    }
    return details.size;
  }

  async readLatest(): Promise<StoredMobileRelease | null> {
    await this.operation;
    return this.readLatestUnlocked();
  }

  async resolveDownload(): Promise<{
    metadata: StoredMobileRelease;
    path: string;
  } | null> {
    const metadata = await this.readLatest();
    if (!metadata) return null;

    const path = resolve(this.releasesPath, metadata.storedFilename);
    if (!isInside(this.releasesPath, path)) return null;
    try {
      if (!(await stat(path)).isFile()) return null;
      return { metadata, path };
    } catch {
      return null;
    }
  }

  publish(
    temporaryApkPath: string,
    input: IncomingMobileRelease,
    size: number,
  ): Promise<{ release: StoredMobileRelease; reused: boolean }> {
    return this.exclusive(async () => {
      const metadata = validateReleaseMetadata(input);
      const temporaryPath = resolve(temporaryApkPath);
      if (!isInside(this.temporaryPath, temporaryPath)) {
        throw new MobileReleaseValidationError("Invalid temporary APK path.");
      }

      const current = await this.readLatestUnlocked(true);
      if (current && metadata.versionCode < current.versionCode) {
        throw new MobileReleaseConflictError(
          `Android versionCode ${metadata.versionCode} is older than current versionCode ${current.versionCode}.`,
        );
      }
      if (current && metadata.versionCode === current.versionCode) {
        if (
          metadata.easBuildId === current.easBuildId &&
          metadata.commit === current.commit
        ) {
          await this.discardTemporaryUpload(temporaryPath);
          await this.enforceRetention(current.storedFilename);
          return { release: current, reused: true };
        }
        throw new MobileReleaseConflictError(
          `Android versionCode ${metadata.versionCode} is already published.`,
        );
      }

      const storedFilename = `wariatkowo-${metadata.version}-${metadata.versionCode}.apk`;
      const releasePath = resolve(this.releasesPath, storedFilename);
      if (!isInside(this.releasesPath, releasePath)) {
        throw new MobileReleaseValidationError("Invalid release path.");
      }

      const release: StoredMobileRelease = {
        ...metadata,
        filename: `wariatkowo-android-${metadata.version}-${metadata.versionCode}.apk`,
        storedFilename,
        size,
        uploadedAt: new Date().toISOString(),
      };
      const latestApkTemporary = join(
        this.temporaryPath,
        `latest-${randomUUID()}.apk`,
      );
      const metadataTemporary = join(
        this.temporaryPath,
        `latest-${randomUUID()}.json`,
      );

      try {
        await rename(temporaryPath, releasePath);
        await copyFile(releasePath, latestApkTemporary);
        await writeFile(
          metadataTemporary,
          `${JSON.stringify(release, null, 2)}\n`,
          {
            encoding: "utf8",
            flag: "wx",
          },
        );
        await rename(latestApkTemporary, this.latestApkPath);
        await rename(metadataTemporary, this.latestMetadataPath);
      } catch (error) {
        await Promise.all([
          rm(latestApkTemporary, { force: true }).catch(() => undefined),
          rm(metadataTemporary, { force: true }).catch(() => undefined),
        ]);
        throw error;
      }

      await this.enforceRetention(release.storedFilename);
      return { release, reused: false };
    });
  }

  private exclusive<T>(action: () => Promise<T>): Promise<T> {
    const result = this.operation.then(action, action);
    this.operation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async readLatestUnlocked(
    failOnInvalidState = false,
  ): Promise<StoredMobileRelease | null> {
    let serialized: string;
    try {
      serialized = await readFile(this.latestMetadataPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (failOnInvalidState) throw error;
      console.error("Could not read Android release metadata.");
      return null;
    }

    try {
      const release = parseStoredRelease(JSON.parse(serialized));
      if (!release)
        throw new Error("Stored Android release metadata is invalid.");
      const releasePath = resolve(this.releasesPath, release.storedFilename);
      if (!isInside(this.releasesPath, releasePath)) {
        throw new Error("Stored Android release path is invalid.");
      }
      if (!(await stat(releasePath)).isFile()) {
        throw new Error("Stored Android release APK is missing.");
      }
      return release;
    } catch (error) {
      if (failOnInvalidState) throw error;
      console.error("Could not read Android release metadata.");
      return null;
    }
  }

  private async enforceRetention(currentFilename: string): Promise<void> {
    const entries = await readdir(this.releasesPath, { withFileTypes: true });
    const releases = entries
      .filter(
        (entry) => entry.isFile() && STORED_FILENAME_PATTERN.test(entry.name),
      )
      .map((entry) => ({
        filename: entry.name,
        versionCode: Number(entry.name.match(/-([1-9][0-9]*)\.apk$/)?.[1] ?? 0),
      }))
      .sort((first, second) => second.versionCode - first.versionCode);

    const retained = new Set(
      releases.slice(0, this.retentionCount).map((entry) => entry.filename),
    );
    retained.add(currentFilename);
    await Promise.all(
      releases
        .filter((entry) => !retained.has(entry.filename))
        .map((entry) =>
          rm(join(this.releasesPath, entry.filename), { force: true }),
        ),
    );
  }
}
