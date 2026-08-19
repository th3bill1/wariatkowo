import type { HouseholdMemberSlug } from "../../shared/models";

export type GoogleAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  allowedUsers: ReadonlyMap<string, HouseholdMemberSlug>;
};

type Environment = Record<string, string | undefined>;
const MEMBER_SLUGS = new Set<HouseholdMemberSlug>(["misiek", "miska"]);
const LOCAL_REDIRECT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeGoogleEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseGoogleAllowedUsers(
  rawValue: string | undefined,
): ReadonlyMap<string, HouseholdMemberSlug> {
  if (!rawValue?.trim()) {
    throw new Error("GOOGLE_ALLOWED_USERS_JSON is required.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error("GOOGLE_ALLOWED_USERS_JSON must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "GOOGLE_ALLOWED_USERS_JSON must be a JSON object mapping emails to member slugs.",
    );
  }

  const allowedUsers = new Map<string, HouseholdMemberSlug>();
  const mappedSlugs = new Set<HouseholdMemberSlug>();
  for (const [emailValue, slugValue] of Object.entries(parsed)) {
    const email = normalizeGoogleEmail(emailValue);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(
        "GOOGLE_ALLOWED_USERS_JSON contains an invalid email address.",
      );
    }
    if (
      typeof slugValue !== "string" ||
      !MEMBER_SLUGS.has(slugValue as HouseholdMemberSlug)
    ) {
      throw new Error(
        'GOOGLE_ALLOWED_USERS_JSON values must be "misiek" or "miska".',
      );
    }
    const slug = slugValue as HouseholdMemberSlug;
    if (allowedUsers.has(email)) {
      throw new Error(
        "GOOGLE_ALLOWED_USERS_JSON contains duplicate normalized emails.",
      );
    }
    if (mappedSlugs.has(slug)) {
      throw new Error(
        `GOOGLE_ALLOWED_USERS_JSON must map exactly one account to ${slug}.`,
      );
    }
    allowedUsers.set(email, slug);
    mappedSlugs.add(slug);
  }

  for (const slug of MEMBER_SLUGS) {
    if (!mappedSlugs.has(slug)) {
      throw new Error(
        `GOOGLE_ALLOWED_USERS_JSON must include one account mapped to ${slug}.`,
      );
    }
  }
  return allowedUsers;
}

function requiredEnvironment(source: Environment, name: string): string {
  const value = source[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function loadGoogleAuthConfig(
  source: Environment = process.env,
): GoogleAuthConfig {
  const clientId = requiredEnvironment(source, "GOOGLE_CLIENT_ID");
  const clientSecret = requiredEnvironment(source, "GOOGLE_CLIENT_SECRET");
  const redirectUri = requiredEnvironment(source, "GOOGLE_REDIRECT_URI");
  let parsedRedirectUri: URL;
  try {
    parsedRedirectUri = new URL(redirectUri);
  } catch {
    throw new Error("GOOGLE_REDIRECT_URI must be an absolute URL.");
  }
  if (
    !["http:", "https:"].includes(parsedRedirectUri.protocol) ||
    parsedRedirectUri.username ||
    parsedRedirectUri.password ||
    parsedRedirectUri.hash
  ) {
    throw new Error(
      "GOOGLE_REDIRECT_URI must be an HTTP(S) URL without credentials or a fragment.",
    );
  }
  if (
    parsedRedirectUri.protocol !== "https:" &&
    !LOCAL_REDIRECT_HOSTS.has(parsedRedirectUri.hostname)
  ) {
    throw new Error(
      "GOOGLE_REDIRECT_URI must use HTTPS except for local development.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: parsedRedirectUri.toString(),
    allowedUsers: parseGoogleAllowedUsers(source.GOOGLE_ALLOWED_USERS_JSON),
  };
}
