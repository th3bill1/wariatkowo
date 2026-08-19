import type { GoogleAuthConfig } from "../auth/googleConfig";

export type GoogleCalendarConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const LOCAL_REDIRECT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function loadGoogleCalendarConfig(
  authConfig: GoogleAuthConfig,
  source: Record<string, string | undefined> = process.env,
): GoogleCalendarConfig {
  const redirectUri = source.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (!redirectUri)
    throw new Error("GOOGLE_CALENDAR_REDIRECT_URI is required.");

  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error("GOOGLE_CALENDAR_REDIRECT_URI must be an absolute URL.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error(
      "GOOGLE_CALENDAR_REDIRECT_URI must be an HTTP(S) URL without credentials or a fragment.",
    );
  }
  if (
    parsed.protocol !== "https:" &&
    !LOCAL_REDIRECT_HOSTS.has(parsed.hostname)
  ) {
    throw new Error(
      "GOOGLE_CALENDAR_REDIRECT_URI must use HTTPS except for local development.",
    );
  }

  return {
    clientId: authConfig.clientId,
    clientSecret: authConfig.clientSecret,
    redirectUri: parsed.toString(),
  };
}
