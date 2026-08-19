import { timingSafeEqual } from "node:crypto";
import { readCookie } from "../_shared/auth";

export const GOOGLE_OAUTH_COOKIE = "wariatkowo_google_oauth";
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

type OAuthTransaction = {
  state: string;
  codeVerifier: string;
  expiresAt: number;
};

function cookieAttributes(secure: boolean): string[] {
  return [
    "Path=/api/auth/google/callback",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
  ].filter(Boolean);
}

export function createOAuthStateCookie(
  state: string,
  codeVerifier: string,
  secure = true,
  now = Date.now(),
): string {
  const transaction: OAuthTransaction = {
    state,
    codeVerifier,
    expiresAt: now + OAUTH_STATE_TTL_SECONDS * 1000,
  };
  const value = Buffer.from(JSON.stringify(transaction)).toString("base64url");
  return [
    `${GOOGLE_OAUTH_COOKIE}=${encodeURIComponent(value)}`,
    ...cookieAttributes(secure),
    `Max-Age=${OAUTH_STATE_TTL_SECONDS}`,
  ].join("; ");
}

export function clearOAuthStateCookie(secure = true): string {
  return [
    `${GOOGLE_OAUTH_COOKIE}=`,
    ...cookieAttributes(secure),
    "Max-Age=0",
  ].join("; ");
}

export function readOAuthTransaction(
  request: Request,
  now = Date.now(),
): OAuthTransaction | null {
  const value = readCookie(request, GOOGLE_OAUTH_COOKIE);
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<OAuthTransaction>;
    if (
      typeof parsed.state !== "string" ||
      parsed.state.length < 32 ||
      typeof parsed.codeVerifier !== "string" ||
      parsed.codeVerifier.length < 43 ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now
    ) {
      return null;
    }
    return parsed as OAuthTransaction;
  } catch {
    return null;
  }
}

export function oauthStatesMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return (
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes)
  );
}
