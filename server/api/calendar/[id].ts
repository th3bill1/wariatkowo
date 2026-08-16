import type { UpdateCalendarEventInput } from "../../../shared/models";
import { isAuthResponse, requireAuth } from "../../_shared/auth";
import {
  CALENDAR_COLUMNS,
  isCalendarEventType,
  parseCalendarDate,
  toCalendarEvent,
  type CalendarRow,
} from "../../_shared/calendar";
import {
  error,
  methodNotAllowed,
  nowIso,
  parseOptionalString,
  parseTrimmedString,
  readJsonBody,
  success,
  type Env,
} from "../../_shared/http";
const select =
  "SELECT " +
  CALENDAR_COLUMNS +
  " FROM calendar_events e JOIN household_members m ON m.id=e.created_by_member_id";
export async function onRequest(context: {
  request: Request;
  env: Env;
  params: { id: string };
}): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  const id = context.params.id;
  const existing = await context.env.DB.prepare(select + " WHERE e.id=?")
    .bind(id)
    .first<CalendarRow>();
  if (!existing) return error("NOT_FOUND", "Nie znaleziono wydarzenia.", 404);
  if (context.request.method === "DELETE") {
    await context.env.DB.prepare("DELETE FROM calendar_events WHERE id=?")
      .bind(id)
      .run();
    return new Response(null, { status: 204 });
  }
  if (context.request.method === "PATCH") {
    let body: unknown;
    try {
      body = await readJsonBody(context.request);
    } catch {
      return error(
        "VALIDATION_ERROR",
        "Treść żądania nie jest poprawnym JSON-em.",
      );
    }
    const input = body as UpdateCalendarEventInput,
      allDay = input.allDay ?? Boolean(existing.all_day);
    const title =
        input.title === undefined
          ? existing.title
          : parseTrimmedString(input.title),
      description =
        input.description === undefined
          ? existing.description
          : parseOptionalString(input.description),
      type = input.type ?? existing.type;
    const start =
      input.startDate === undefined
        ? parseCalendarDate(existing.start_date, allDay)
        : parseCalendarDate(input.startDate, allDay);
    const rawEnd =
        input.endDate === undefined ? existing.end_date : input.endDate,
      end = rawEnd ? parseCalendarDate(rawEnd, allDay) : null;
    if (
      !title ||
      title.length > 180 ||
      !isCalendarEventType(type) ||
      !start ||
      (rawEnd && end === undefined) ||
      (end && end < start)
    )
      return error("VALIDATION_ERROR", "Dane wydarzenia są niepoprawne.");
    await context.env.DB.prepare(
      "UPDATE calendar_events SET title=?,description=?,type=?,start_date=?,end_date=?,all_day=?,updated_at=? WHERE id=?",
    )
      .bind(
        title,
        description ?? null,
        type,
        start,
        end ?? null,
        allDay ? 1 : 0,
        nowIso(),
        id,
      )
      .run();
    const row = await context.env.DB.prepare(select + " WHERE e.id=?")
      .bind(id)
      .first<CalendarRow>();
    return success(toCalendarEvent(row!));
  }
  return methodNotAllowed(["PATCH", "DELETE"]);
}
