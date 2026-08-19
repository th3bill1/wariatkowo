import { isAuthResponse, requireAuth, sha256 } from "../../../_shared/auth";
import {
  error,
  methodNotAllowed,
  nowIso,
  type Env,
} from "../../../_shared/http";
import { normalizeGoogleEmail } from "../../../auth/googleConfig";
import {
  CALENDAR_OAUTH_STATE_TTL_SECONDS,
  createCalendarOAuthCookie,
} from "../../../googleCalendar/oauthState";

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  const integration = context.env.GOOGLE_CALENDAR;
  if (!integration) {
    return error(
      "NOT_CONFIGURED",
      "Integracja z Kalendarzem Google nie jest skonfigurowana.",
      503,
    );
  }
  const member = await context.env.DB.prepare(
    "SELECT google_email, google_sub FROM household_members WHERE id = ?",
  )
    .bind(auth.member.id)
    .first<{ google_email: string | null; google_sub: string | null }>();
  if (!member?.google_email || !member.google_sub) {
    return error(
      "NOT_CONFIGURED",
      "Najpierw zaloguj się ponownie przez Google.",
      409,
    );
  }

  let authorization;
  try {
    authorization = await integration.client.createAuthorizationRequest(
      normalizeGoogleEmail(member.google_email),
    );
  } catch (reason) {
    console.error(
      `Unable to start Google Calendar authorization for member ${auth.member.id} (${reason instanceof Error ? reason.name : "UnknownError"}).`,
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/kalendarz?googleCalendar=oauth_failed",
        "Cache-Control": "no-store",
      },
    });
  }
  const now = nowIso();
  const expiresAt = new Date(
    Date.now() + CALENDAR_OAUTH_STATE_TTL_SECONDS * 1000,
  ).toISOString();
  await context.env.DB.prepare(
    "DELETE FROM google_calendar_oauth_states WHERE expires_at <= ? OR member_id = ?",
  )
    .bind(now, auth.member.id)
    .run();
  await context.env.DB.prepare(
    "INSERT INTO google_calendar_oauth_states (state_hash,member_id,session_id,expires_at,created_at) VALUES (?,?,?,?,?)",
  )
    .bind(
      await sha256(authorization.state),
      auth.member.id,
      auth.sessionId,
      expiresAt,
      now,
    )
    .run();

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorization.authorizationUrl,
      "Cache-Control": "no-store",
      "Set-Cookie": createCalendarOAuthCookie(
        {
          state: authorization.state,
          codeVerifier: authorization.codeVerifier,
          memberId: auth.member.id,
          sessionId: auth.sessionId,
        },
        context.env.COOKIE_SECURE ?? true,
      ),
    },
  });
}
