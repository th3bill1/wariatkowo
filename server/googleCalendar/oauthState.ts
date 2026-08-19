import { timingSafeEqual } from "node:crypto";
import { readCookie } from "../_shared/auth";

export const GOOGLE_CALENDAR_OAUTH_COOKIE = "wariatkowo_calendar_oauth";
export const CALENDAR_OAUTH_STATE_TTL_SECONDS = 10 * 60;

export type CalendarOAuthTransaction = {
  state: string;
  codeVerifier: string;
  memberId: string;
  sessionId: string;
  expiresAt: number;
};

function attributes(secure: boolean): string[] {
  return [
    "Path=/api/integrations/google-calendar/callback",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
  ].filter(Boolean);
}

export function createCalendarOAuthCookie(
  transaction: Omit<CalendarOAuthTransaction, "expiresAt">,
  secure = true,
  now = Date.now(),
): string {
  const value = Buffer.from(
    JSON.stringify({
      ...transaction,
      expiresAt: now + CALENDAR_OAUTH_STATE_TTL_SECONDS * 1000,
    }),
  ).toString("base64url");
  return [
    `${GOOGLE_CALENDAR_OAUTH_COOKIE}=${encodeURIComponent(value)}`,
    ...attributes(secure),
    `Max-Age=${CALENDAR_OAUTH_STATE_TTL_SECONDS}`,
  ].join("; ");
}

export function clearCalendarOAuthCookie(secure = true): string {
  return [
    `${GOOGLE_CALENDAR_OAUTH_COOKIE}=`,
    ...attributes(secure),
    "Max-Age=0",
  ].join("; ");
}

export function readCalendarOAuthTransaction(
  request: Request,
  now = Date.now(),
): CalendarOAuthTransaction | null {
  const value = readCookie(request, GOOGLE_CALENDAR_OAUTH_COOKIE);
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<CalendarOAuthTransaction>;
    if (
      typeof parsed.state !== "string" ||
      parsed.state.length < 32 ||
      typeof parsed.codeVerifier !== "string" ||
      parsed.codeVerifier.length < 43 ||
      typeof parsed.memberId !== "string" ||
      !parsed.memberId ||
      typeof parsed.sessionId !== "string" ||
      !parsed.sessionId ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= now
    ) {
      return null;
    }
    return parsed as CalendarOAuthTransaction;
  } catch {
    return null;
  }
}

export function secureStateMatch(expected: string, received: string): boolean {
  const first = Buffer.from(expected);
  const second = Buffer.from(received);
  return first.length === second.length && timingSafeEqual(first, second);
}
