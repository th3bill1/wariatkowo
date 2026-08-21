import { resolve } from "node:path";

export type MobileReleaseConfig = {
  rootPath: string;
  deployToken: string | null;
  maxFileSizeBytes: number;
  retentionCount: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  requireHttps: boolean;
};

function positiveInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const value = environment[name]?.trim();
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export function loadMobileReleaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MobileReleaseConfig {
  const deployToken =
    environment.WARIATKOWO_MOBILE_DEPLOY_TOKEN?.trim() || null;
  if (deployToken && deployToken.length < 32) {
    throw new Error(
      "WARIATKOWO_MOBILE_DEPLOY_TOKEN must contain at least 32 characters.",
    );
  }

  return {
    rootPath: resolve(
      environment.MOBILE_RELEASES_PATH?.trim() ||
        (environment.NODE_ENV === "production"
          ? "/app/data/mobile"
          : "./data/mobile"),
    ),
    deployToken,
    maxFileSizeBytes:
      positiveInteger(environment, "MOBILE_RELEASE_MAX_SIZE_MB", 200) *
      1024 *
      1024,
    retentionCount: positiveInteger(environment, "MOBILE_RELEASE_RETENTION", 5),
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMax: 10,
    requireHttps: environment.NODE_ENV === "production",
  };
}
