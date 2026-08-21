import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import { getAuthenticatedSession } from "../_shared/auth";
import type { Env } from "../_shared/http";
import type { MobileReleaseConfig } from "./config";
import {
  MobileReleaseConflictError,
  MobileReleaseStorage,
  MobileReleaseValidationError,
  publicReleaseStatus,
  validateReleaseMetadata,
  type IncomingMobileRelease,
} from "./storage";

const APK_CONTENT_TYPE = "application/vnd.android.package-archive";
const acceptedUploadTypes = new Set([
  APK_CONTENT_TYPE,
  "application/octet-stream",
  "application/zip",
]);

type ParsedUpload = {
  temporaryPath: string;
  metadata: IncomingMobileRelease;
  size: number;
};

class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "VALIDATION_ERROR" | "SERVICE_UNAVAILABLE",
  ) {
    super(message);
  }
}

function apiError(
  response: ExpressResponse,
  status: number,
  code: string,
  message: string,
): void {
  response.status(status).json({ error: { code, message } });
}

function secureEqual(actual: string, expected: string): boolean {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function deployBearerToken(request: ExpressRequest): string | null {
  const authorization = request.get("Authorization");
  return authorization?.match(/^Bearer ([^\s]+)$/)?.[1] ?? null;
}

function webAuthRequest(request: ExpressRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return new Request("http://wariatkowo.local/", { headers });
}

function parseVersionCode(value: string | undefined): number {
  if (!value || !/^[1-9][0-9]*$/.test(value)) return Number.NaN;
  return Number(value);
}

async function settleFileWrite(write: Promise<void> | null): Promise<void> {
  if (write) await write.catch(() => undefined);
}

async function parseUpload(
  request: ExpressRequest,
  storage: MobileReleaseStorage,
  config: MobileReleaseConfig,
): Promise<ParsedUpload> {
  const contentType = request.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new UploadError(
      "Expected a multipart Android APK upload.",
      415,
      "VALIDATION_ERROR",
    );
  }
  const contentLength = Number(request.get("Content-Length") ?? 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > config.maxFileSizeBytes + 64 * 1024
  ) {
    throw new UploadError("The APK is too large.", 413, "VALIDATION_ERROR");
  }

  const temporaryPath = await storage.createTemporaryUploadPath();
  const fields = new Map<string, string>();
  let uploadedFilename = "";
  let fileSeen = false;
  let fileInvalid = false;
  let fileTooLarge = false;
  let fileWrite: Promise<void> | null = null;
  let activeFile: Readable | null = null;

  try {
    await new Promise<void>((resolve, reject) => {
      let parser: ReturnType<typeof Busboy>;
      try {
        parser = Busboy({
          headers: request.headers,
          limits: {
            fileSize: config.maxFileSizeBytes,
            files: 1,
            fields: 5,
            parts: 7,
            fieldSize: 1024,
          },
        });
      } catch {
        reject(
          new UploadError("Invalid multipart upload.", 400, "VALIDATION_ERROR"),
        );
        return;
      }

      request.once("aborted", () => {
        const error = new UploadError(
          "The APK upload was interrupted.",
          400,
          "VALIDATION_ERROR",
        );
        activeFile?.destroy(error);
        parser.destroy(error);
        reject(error);
      });
      request.once("error", (error) => {
        activeFile?.destroy(error);
        parser.destroy(error);
        reject(error);
      });
      parser.once("error", reject);
      parser.once("filesLimit", () => {
        fileInvalid = true;
      });
      parser.once("fieldsLimit", () => {
        fileInvalid = true;
      });
      parser.once("partsLimit", () => {
        fileInvalid = true;
      });
      parser.on("field", (name, value, info) => {
        if (info.valueTruncated || fields.has(name)) fileInvalid = true;
        fields.set(name, value);
      });
      parser.on("file", (name, file, info) => {
        activeFile = file;
        fileSeen = true;
        uploadedFilename = info.filename;
        if (
          name !== "apk" ||
          !info.filename.toLowerCase().endsWith(".apk") ||
          !acceptedUploadTypes.has(info.mimeType.toLowerCase())
        ) {
          fileInvalid = true;
          file.resume();
          return;
        }
        file.once("limit", () => {
          fileTooLarge = true;
        });
        fileWrite = pipeline(
          file,
          createWriteStream(temporaryPath, { flags: "wx" }),
        );
      });
      parser.once("close", resolve);
      request.pipe(parser);
    });

    if (fileWrite) await fileWrite;
    if (fileTooLarge) {
      throw new UploadError("The APK is too large.", 413, "VALIDATION_ERROR");
    }
    if (!fileSeen || !fileWrite || fileInvalid) {
      throw new UploadError(
        "A single valid APK is required.",
        400,
        "VALIDATION_ERROR",
      );
    }

    let metadata: IncomingMobileRelease;
    try {
      metadata = validateReleaseMetadata({
        version: fields.get("version") ?? "",
        versionCode: parseVersionCode(fields.get("versionCode")),
        builtAt: fields.get("builtAt") ?? "",
        commit: fields.get("commit") ?? "",
        easBuildId: fields.get("easBuildId") ?? "",
        originalFilename: uploadedFilename,
      });
    } catch (error) {
      if (error instanceof MobileReleaseValidationError) {
        throw new UploadError(error.message, 400, "VALIDATION_ERROR");
      }
      throw error;
    }
    const size = await storage.inspectApk(
      temporaryPath,
      config.maxFileSizeBytes,
    );
    return { temporaryPath, metadata, size };
  } catch (error) {
    await settleFileWrite(fileWrite);
    await storage.discardTemporaryUpload(temporaryPath);
    throw error;
  }
}

function createRateLimiter(config: MobileReleaseConfig) {
  const attempts = new Map<string, number[]>();
  return (
    request: ExpressRequest,
    response: ExpressResponse,
    next: () => void,
  ) => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const recent = (attempts.get(key) ?? []).filter(
      (timestamp) => now - timestamp < config.rateLimitWindowMs,
    );
    if (recent.length >= config.rateLimitMax) {
      response.set(
        "Retry-After",
        String(Math.ceil(config.rateLimitWindowMs / 1000)),
      );
      apiError(
        response,
        429,
        "RATE_LIMITED",
        "Too many release upload attempts.",
      );
      return;
    }
    recent.push(now);
    attempts.set(key, recent);
    next();
  };
}

export function createMobileReleaseRouter(options: {
  env: Env;
  storage: MobileReleaseStorage;
  config: MobileReleaseConfig;
}): Router {
  const { env, storage, config } = options;
  const router = Router();

  router.post(
    "/api/internal/mobile-release",
    createRateLimiter(config),
    async (request, response) => {
      if (config.requireHttps && !request.secure) {
        apiError(response, 403, "FORBIDDEN", "Release uploads require HTTPS.");
        return;
      }
      if (!config.deployToken) {
        apiError(
          response,
          503,
          "NOT_CONFIGURED",
          "Android release deployment is not configured.",
        );
        return;
      }
      const token = deployBearerToken(request);
      if (!token || !secureEqual(token, config.deployToken)) {
        apiError(
          response,
          401,
          "UNAUTHORIZED",
          "Invalid deployment credentials.",
        );
        return;
      }

      let temporaryPath: string | null = null;
      try {
        const upload = await parseUpload(request, storage, config);
        temporaryPath = upload.temporaryPath;
        const published = await storage.publish(
          upload.temporaryPath,
          upload.metadata,
          upload.size,
        );
        temporaryPath = null;
        response.status(published.reused ? 200 : 201).json({
          data: publicReleaseStatus(published.release),
        });
      } catch (error) {
        if (error instanceof UploadError) {
          apiError(response, error.status, error.code, error.message);
          return;
        }
        if (error instanceof MobileReleaseConflictError) {
          apiError(response, 409, "CONFLICT", error.message);
          return;
        }
        if (error instanceof MobileReleaseValidationError) {
          apiError(response, 400, "VALIDATION_ERROR", error.message);
          return;
        }
        console.error("Android release upload failed.");
        apiError(
          response,
          500,
          "INTERNAL_ERROR",
          "Could not publish the Android release.",
        );
      } finally {
        await storage.discardTemporaryUpload(temporaryPath);
      }
    },
  );

  router.get("/api/mobile/latest", async (request, response) => {
    if (!(await getAuthenticatedSession(webAuthRequest(request), env))) {
      apiError(
        response,
        401,
        "UNAUTHORIZED",
        "Zaloguj się, aby pobrać aplikację.",
      );
      return;
    }
    response.set("Cache-Control", "private, no-store");
    response.json({ data: publicReleaseStatus(await storage.readLatest()) });
  });

  router.get("/api/mobile/download", async (request, response, next) => {
    if (!(await getAuthenticatedSession(webAuthRequest(request), env))) {
      apiError(
        response,
        401,
        "UNAUTHORIZED",
        "Zaloguj się, aby pobrać aplikację.",
      );
      return;
    }
    const download = await storage.resolveDownload();
    if (!download) {
      apiError(
        response,
        404,
        "NOT_FOUND",
        "Nie opublikowano jeszcze aplikacji Android.",
      );
      return;
    }

    try {
      const details = await stat(download.path);
      response.set({
        "Content-Type": APK_CONTENT_TYPE,
        "Content-Length": String(details.size),
        "Content-Disposition": `attachment; filename="${download.metadata.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      const stream = createReadStream(download.path);
      stream.once("error", next);
      stream.pipe(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
