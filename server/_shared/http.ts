import type {
  ApiErrorCode,
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../shared/api";
import type { DatabaseClient } from "../db/types";
import type { GoogleAuthDependencies } from "../auth/googleClient";

export interface Env {
  DB: DatabaseClient;
  COOKIE_SECURE?: boolean;
  GOOGLE_AUTH?: GoogleAuthDependencies;
}

function jsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json; charset=utf-8",
  };
}

export function success<T>(data: T, init?: ResponseInit): Response {
  const body: ApiSuccessResponse<T> = { data };
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders(),
      ...(init?.headers ?? {}),
    },
  });
}

export function error(
  code: ApiErrorCode,
  message: string,
  status = 400,
): Response {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(),
  });
}

export function methodNotAllowed(allowedMethods: string[]): Response {
  return error("METHOD_NOT_ALLOWED", "Metoda nie jest obsługiwana.", 405);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() : undefined;
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

export function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

export function parseOptionalIsoDate(
  value: unknown,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

export function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}
