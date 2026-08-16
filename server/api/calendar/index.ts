import type { CreateCalendarEventInput } from "../../../shared/models";
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
  isNonEmptyString,
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
}): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  if (context.request.method === "GET") {
    const url = new URL(context.request.url),
      from = url.searchParams.get("from"),
      to = url.searchParams.get("to");
    if (
      !from ||
      !to ||
      !/^\d{4}-\d{2}-\d{2}/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}/.test(to)
    )
      return error("VALIDATION_ERROR", "Podaj poprawny zakres from i to.");
    const result = await context.env.DB.prepare(
      select +
        " WHERE e.start_date <= ? AND COALESCE(e.end_date,e.start_date) >= ? ORDER BY e.start_date ASC",
    )
      .bind(to, from)
      .all<CalendarRow>();
    return success(result.results.map(toCalendarEvent));
  }
  if (context.request.method === "POST") {
    let body: unknown;
    try {
      body = await readJsonBody(context.request);
    } catch {
      return error(
        "VALIDATION_ERROR",
        "Treść żądania nie jest poprawnym JSON-em.",
      );
    }
    const input = body as Partial<CreateCalendarEventInput>,
      title = parseTrimmedString(input.title),
      description = parseOptionalString(input.description),
      allDay = input.allDay ?? true,
      type = input.type ?? "event";
    const start = parseCalendarDate(input.startDate, allDay),
      end = input.endDate ? parseCalendarDate(input.endDate, allDay) : null;
    if (!isNonEmptyString(title) || title.length > 180)
      return error(
        "VALIDATION_ERROR",
        "Podaj nazwę wydarzenia (maks. 180 znaków).",
      );
    if (!isCalendarEventType(type) || !start)
      return error(
        "VALIDATION_ERROR",
        "Typ lub data wydarzenia są niepoprawne.",
      );
    if (input.endDate && end === undefined)
      return error("VALIDATION_ERROR", "Data końcowa jest niepoprawna.");
    if (end && end < start)
      return error("VALIDATION_ERROR", "Koniec nie może być przed początkiem.");
    const id = crypto.randomUUID(),
      timestamp = nowIso();
    await context.env.DB.prepare(
      "INSERT INTO calendar_events (id,title,description,type,start_date,end_date,all_day,created_by_member_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        title,
        description ?? null,
        type,
        start,
        end ?? null,
        allDay ? 1 : 0,
        auth.member.id,
        timestamp,
        timestamp,
      )
      .run();
    const row = await context.env.DB.prepare(select + " WHERE e.id=?")
      .bind(id)
      .first<CalendarRow>();
    return row
      ? success(toCalendarEvent(row), { status: 201 })
      : error("INTERNAL_ERROR", "Nie udało się utworzyć wydarzenia.", 500);
  }
  return methodNotAllowed(["GET", "POST"]);
}
