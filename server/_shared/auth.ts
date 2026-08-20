import type { HouseholdMember } from "../../shared/models";
import { error, nowIso, type Env } from "./http";

export const SESSION_COOKIE = "wariatkowo_session";
const encoder = new TextEncoder();

export type AuthenticatedSession = {
  member: HouseholdMember;
  sessionId: string;
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
export async function sha256(value: string): Promise<string> {
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
export function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}
export async function getAuthenticatedSession(
  request: Request,
  env: Env,
): Promise<AuthenticatedSession | null> {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer ([A-Za-z0-9-]+)$/)?.[1] ?? readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT s.id AS session_id, m.id, m.name, m.slug FROM sessions s JOIN household_members m ON m.id = s.member_id WHERE s.token_hash = ? AND s.expires_at > ?",
  )
    .bind(await sha256(token), new Date().toISOString())
    .first<{
      session_id: string;
      id: string;
      name: string;
      slug: "misiek" | "miska";
    }>();
  return row
    ? {
        sessionId: row.session_id,
        member: { id: row.id, name: row.name, slug: row.slug },
      }
    : null;
}
export async function requireAuth(
  request: Request,
  env: Env,
): Promise<AuthenticatedSession | Response> {
  return (
    (await getAuthenticatedSession(request, env)) ??
    error("UNAUTHORIZED", "Zaloguj się, aby wejść do Wariatkowa.", 401)
  );
}
export function isAuthResponse(
  value: AuthenticatedSession | Response,
): value is Response {
  return value instanceof Response;
}
export function createSessionCookie(
  token: string,
  expiresAt: Date,
  secure = true,
): string {
  return [
    SESSION_COOKIE + "=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Expires=" + expiresAt.toUTCString(),
  ]
    .filter(Boolean)
    .join("; ");
}
export function clearSessionCookie(secure = true): string {
  return [
    SESSION_COOKIE + "=",
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}
export function createSessionExpiry(): Date {
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 30);
  return expires;
}
export async function createApplicationSession(
  env: Env,
  member: HouseholdMember,
): Promise<{ cookie: string; token: string; expiresAt: Date }> {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = createSessionExpiry();
  const timestamp = nowIso();
  await env.DB.prepare(
    "INSERT INTO sessions (id, token_hash, member_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      crypto.randomUUID(),
      await sha256(token),
      member.id,
      expiresAt.toISOString(),
      timestamp,
      timestamp,
    )
    .run();
  return {
    cookie: createSessionCookie(token, expiresAt, env.COOKIE_SECURE ?? true),
    token,
    expiresAt,
  };
}
