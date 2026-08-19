import { getAuthenticatedSession, sha256 } from "../../../_shared/auth";
import { methodNotAllowed, nowIso, type Env } from "../../../_shared/http";
import { normalizeGoogleEmail } from "../../../auth/googleConfig";
import { GOOGLE_CALENDAR_SCOPES } from "../../../googleCalendar/client";
import {
  clearCalendarOAuthCookie,
  readCalendarOAuthTransaction,
  secureStateMatch,
} from "../../../googleCalendar/oauthState";
import { syncConnection } from "../../../googleCalendar/sync";

type CallbackError =
  | "access_denied"
  | "invalid_state"
  | "missing_code"
  | "wrong_account"
  | "offline_access_missing"
  | "missing_scopes"
  | "oauth_failed"
  | "sync_failed";

function redirect(env: Env, value: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: value,
      "Cache-Control": "no-store",
      "Set-Cookie": clearCalendarOAuthCookie(env.COOKIE_SECURE ?? true),
    },
  });
}

function failure(env: Env, code: CallbackError): Response {
  return redirect(env, `/kalendarz?googleCalendar=${code}`);
}

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  const integration = context.env.GOOGLE_CALENDAR;
  if (!integration) return failure(context.env, "oauth_failed");
  const auth = await getAuthenticatedSession(context.request, context.env);
  const transaction = readCalendarOAuthTransaction(context.request);
  const url = new URL(context.request.url);
  const receivedState = url.searchParams.get("state") ?? "";
  if (
    !auth ||
    !transaction ||
    transaction.memberId !== auth.member.id ||
    transaction.sessionId !== auth.sessionId ||
    !receivedState ||
    !secureStateMatch(transaction.state, receivedState)
  ) {
    console.warn("Rejected Google Calendar OAuth callback with invalid state.");
    return failure(context.env, "invalid_state");
  }

  const stateHash = await sha256(transaction.state);
  const state = await context.env.DB.prepare(
    "SELECT member_id,session_id,expires_at,used_at FROM google_calendar_oauth_states WHERE state_hash = ?",
  )
    .bind(stateHash)
    .first<{
      member_id: string;
      session_id: string;
      expires_at: string;
      used_at: string | null;
    }>();
  if (
    !state ||
    state.member_id !== auth.member.id ||
    state.session_id !== auth.sessionId ||
    state.used_at ||
    state.expires_at <= nowIso()
  ) {
    console.warn("Rejected expired or replayed Google Calendar OAuth state.");
    return failure(context.env, "invalid_state");
  }
  const consumed = await context.env.DB.prepare(
    "UPDATE google_calendar_oauth_states SET used_at = ? WHERE state_hash = ? AND used_at IS NULL",
  )
    .bind(nowIso(), stateHash)
    .run();
  if (consumed.meta.changes !== 1) return failure(context.env, "invalid_state");

  if (url.searchParams.has("error")) {
    return failure(
      context.env,
      url.searchParams.get("error") === "access_denied"
        ? "access_denied"
        : "oauth_failed",
    );
  }
  const code = url.searchParams.get("code");
  if (!code) return failure(context.env, "missing_code");

  let authorization;
  try {
    authorization = await integration.client.exchangeAuthorizationCode(
      code,
      transaction.codeVerifier,
    );
  } catch (error) {
    console.error(
      `Google Calendar authorization failed (${error instanceof Error ? error.name : "UnknownError"}).`,
    );
    return failure(context.env, "oauth_failed");
  }

  const expected = await context.env.DB.prepare(
    "SELECT google_sub, google_email FROM household_members WHERE id = ?",
  )
    .bind(auth.member.id)
    .first<{ google_sub: string | null; google_email: string | null }>();
  if (
    !expected?.google_sub ||
    !expected.google_email ||
    !authorization.identity.emailVerified ||
    authorization.identity.sub !== expected.google_sub ||
    normalizeGoogleEmail(authorization.identity.email) !==
      normalizeGoogleEmail(expected.google_email)
  ) {
    console.warn(
      `Rejected Google Calendar account mismatch for member ${auth.member.id}.`,
    );
    return failure(context.env, "wrong_account");
  }
  if (!authorization.refreshToken) {
    return failure(context.env, "offline_access_missing");
  }
  const requiredCalendarScopes = GOOGLE_CALENDAR_SCOPES.filter((scope) =>
    scope.startsWith("https://www.googleapis.com/auth/calendar"),
  );
  if (
    !requiredCalendarScopes.every((scope) =>
      authorization.grantedScopes.includes(scope),
    )
  ) {
    return failure(context.env, "missing_scopes");
  }

  const timestamp = nowIso();
  const existing = await context.env.DB.prepare(
    "SELECT id FROM google_calendar_connections WHERE member_id = ?",
  )
    .bind(auth.member.id)
    .first<{ id: string }>();
  const connectionId = existing?.id ?? crypto.randomUUID();
  const encryptedToken = integration.tokenCipher.encrypt(
    authorization.refreshToken,
  );
  await context.env.DB.prepare(
    `INSERT INTO google_calendar_connections
      (id,member_id,google_sub,google_email,encrypted_refresh_token,granted_scopes,calendar_list_sync_token,connected_at,updated_at,last_sync_at,status,last_error)
     VALUES (?,?,?,?,?,?,NULL,?,?,NULL,'connected',NULL)
     ON CONFLICT(member_id) DO UPDATE SET
       google_sub=excluded.google_sub,
       google_email=excluded.google_email,
       encrypted_refresh_token=excluded.encrypted_refresh_token,
       granted_scopes=excluded.granted_scopes,
       calendar_list_sync_token=NULL,
       connected_at=excluded.connected_at,
       updated_at=excluded.updated_at,
       status='connected',
       last_error=NULL`,
  )
    .bind(
      connectionId,
      auth.member.id,
      authorization.identity.sub,
      normalizeGoogleEmail(authorization.identity.email),
      encryptedToken,
      authorization.grantedScopes.join(" "),
      timestamp,
      timestamp,
    )
    .run();

  try {
    await syncConnection(context.env, connectionId, { forceFull: true });
    return redirect(context.env, "/kalendarz?googleCalendar=connected");
  } catch (error) {
    console.error(
      `Initial Google Calendar sync failed for member ${auth.member.id} (${error instanceof Error ? error.name : "UnknownError"}).`,
    );
    return failure(context.env, "sync_failed");
  }
}
