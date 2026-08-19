import { isAuthResponse, requireAuth } from "../../../_shared/auth";
import { methodNotAllowed, success, type Env } from "../../../_shared/http";
import { recomputeCalendarAfterAccessChange } from "../../../googleCalendar/sync";

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "POST") return methodNotAllowed(["POST"]);
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  const connection = await context.env.DB.prepare(
    "SELECT id,encrypted_refresh_token FROM google_calendar_connections WHERE member_id=?",
  )
    .bind(auth.member.id)
    .first<{ id: string; encrypted_refresh_token: string }>();
  if (!connection) return success({ disconnected: true });
  const calendars = await context.env.DB.prepare(
    "SELECT calendar_id FROM google_calendar_access WHERE connection_id=?",
  )
    .bind(connection.id)
    .all<{ calendar_id: string }>();

  const integration = context.env.GOOGLE_CALENDAR;
  if (integration) {
    try {
      await integration.client.revokeToken(
        integration.tokenCipher.decrypt(connection.encrypted_refresh_token),
      );
    } catch (error) {
      console.warn(
        `Google Calendar token revocation did not complete for member ${auth.member.id} (${error instanceof Error ? error.name : "UnknownError"}).`,
      );
    }
  }
  await context.env.DB.batch([
    context.env.DB.prepare(
      "DELETE FROM google_calendar_oauth_states WHERE member_id=?",
    ).bind(auth.member.id),
    context.env.DB.prepare(
      "DELETE FROM google_calendar_connections WHERE id=?",
    ).bind(connection.id),
  ]);
  for (const calendar of calendars.results) {
    await recomputeCalendarAfterAccessChange(
      context.env,
      calendar.calendar_id,
    ).catch((error) =>
      console.error(
        `Shared calendar resync failed after disconnect for calendar ${calendar.calendar_id} (${error instanceof Error ? error.name : "UnknownError"}).`,
      ),
    );
  }
  return success({ disconnected: true });
}
