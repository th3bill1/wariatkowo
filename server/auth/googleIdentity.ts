import type { HouseholdMember, HouseholdMemberSlug } from "../../shared/models";
import type { Env } from "../_shared/http";
import { nowIso } from "../_shared/http";
import { normalizeGoogleEmail } from "./googleConfig";
import type { GoogleIdentity } from "./googleClient";

type GoogleMemberRow = HouseholdMember & {
  google_email: string | null;
  google_sub: string | null;
};

export class GoogleAccountNotAllowedError extends Error {
  constructor() {
    super("Google account is not in the configured whitelist.");
    this.name = "GoogleAccountNotAllowedError";
  }
}

export class GoogleIdentityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleIdentityConflictError";
  }
}

const MEMBER_COLUMNS = "id, name, slug, google_email, google_sub";

function publicMember(row: GoogleMemberRow): HouseholdMember {
  return { id: row.id, name: row.name, slug: row.slug };
}

function ensureExpectedMember(
  row: GoogleMemberRow,
  expectedSlug: HouseholdMemberSlug,
): void {
  if (row.slug !== expectedSlug) {
    throw new GoogleIdentityConflictError(
      `Stored Google identity belongs to ${row.slug}, but the whitelist maps it to ${expectedSlug}.`,
    );
  }
}

export async function mapGoogleIdentityToMember(
  env: Env,
  identity: GoogleIdentity,
): Promise<HouseholdMember> {
  const googleAuth = env.GOOGLE_AUTH;
  if (!googleAuth) throw new Error("Google authentication is not configured.");
  const email = normalizeGoogleEmail(identity.email);
  const expectedSlug = googleAuth.config.allowedUsers.get(email);
  if (!expectedSlug) throw new GoogleAccountNotAllowedError();

  const bySubject = await env.DB.prepare(
    `SELECT ${MEMBER_COLUMNS} FROM household_members WHERE google_sub = ?`,
  )
    .bind(identity.sub)
    .first<GoogleMemberRow>();
  if (bySubject) {
    ensureExpectedMember(bySubject, expectedSlug);
    if (normalizeGoogleEmail(bySubject.google_email ?? "") !== email) {
      try {
        await env.DB.prepare(
          "UPDATE household_members SET google_email = ?, updated_at = ? WHERE id = ? AND google_sub = ?",
        )
          .bind(email, nowIso(), bySubject.id, identity.sub)
          .run();
      } catch {
        throw new GoogleIdentityConflictError(
          "The Google subject is already linked, but its current email conflicts with another member.",
        );
      }
    }
    return publicMember(bySubject);
  }

  const byEmail = await env.DB.prepare(
    `SELECT ${MEMBER_COLUMNS} FROM household_members WHERE google_email = ? COLLATE NOCASE`,
  )
    .bind(email)
    .first<GoogleMemberRow>();
  if (byEmail) {
    ensureExpectedMember(byEmail, expectedSlug);
    if (byEmail.google_sub && byEmail.google_sub !== identity.sub) {
      throw new GoogleIdentityConflictError(
        "The whitelisted email is already linked to a different Google subject.",
      );
    }
  }

  const target =
    byEmail ??
    (await env.DB.prepare(
      `SELECT ${MEMBER_COLUMNS} FROM household_members WHERE slug = ?`,
    )
      .bind(expectedSlug)
      .first<GoogleMemberRow>());
  if (!target) {
    throw new GoogleIdentityConflictError(
      `The configured household member ${expectedSlug} does not exist.`,
    );
  }
  if (
    (target.google_sub && target.google_sub !== identity.sub) ||
    (target.google_email && normalizeGoogleEmail(target.google_email) !== email)
  ) {
    throw new GoogleIdentityConflictError(
      `Household member ${expectedSlug} is already linked to a different Google identity.`,
    );
  }

  try {
    const result = await env.DB.prepare(
      `UPDATE household_members
       SET google_email = ?, google_sub = ?, updated_at = ?
       WHERE id = ?
         AND (google_email IS NULL OR google_email = ? COLLATE NOCASE)
         AND (google_sub IS NULL OR google_sub = ?)`,
    )
      .bind(email, identity.sub, nowIso(), target.id, email, identity.sub)
      .run();
    if (result.meta.changes !== 1) {
      throw new GoogleIdentityConflictError(
        "Google identity association changed concurrently.",
      );
    }
  } catch (error) {
    if (error instanceof GoogleIdentityConflictError) throw error;
    throw new GoogleIdentityConflictError(
      "Google identity violates an existing unique association.",
    );
  }
  return publicMember(target);
}
