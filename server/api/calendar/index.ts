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
import {
  CalendarIntegrationUnavailableError,
  CalendarPermissionError,
  createGoogleEvent,
  listGoogleEvents,
} from "../../googleCalendar/data";
import { syncAllConnections } from "../../googleCalendar/sync";
import { describeGoogleCalendarError } from "../../googleCalendar/client";

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
    const url = new URL(context.request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (
      !from ||
      !to ||
      !/^\d{4}-\d{2}-\d{2}/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}/.test(to)
    ) {
      return error("VALIDATION_ERROR", "Podaj poprawny zakres from i to.");
    }
    if (context.env.GOOGLE_CALENDAR) {
      await syncAllConnections(context.env).catch(() => undefined);
    }
    const inclusiveTo =
      to.length === 10 ? `${to}T23:59:59.999Z` : to;
    const result = await context.env.DB.prepare(
      select +
        " WHERE e.start_date <= ? AND COALESCE(e.end_date,e.start_date) >= ? ORDER BY e.start_date ASC",
    )
      .bind(inclusiveTo, from)
      .all<CalendarRow>();
    const googleEvents = await listGoogleEvents(context.env, from, inclusiveTo);
    return success(
      [...result.results.map(toCalendarEvent), ...googleEvents].sort(
        (first, second) => first.startDate.localeCompare(second.startDate),
      ),
    );
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
    const input = body as Partial<CreateCalendarEventInput>;
    const title = parseTrimmedString(input.title);
    const description = parseOptionalString(input.description);
    const allDay = input.allDay ?? true;
    const type = input.type ?? "event";
    const start = parseCalendarDate(input.startDate, allDay);
    const end = input.endDate ? parseCalendarDate(input.endDate, allDay) : null;
    if (!isNonEmptyString(title) || title.length > 180) {
      return error(
        "VALIDATION_ERROR",
        "Podaj nazwę wydarzenia (maks. 180 znaków).",
      );
    }
    if (!isCalendarEventType(type) || !start) {
      return error(
        "VALIDATION_ERROR",
        "Typ lub data wydarzenia są niepoprawne.",
      );
    }
    if (input.endDate && end === undefined) {
      return error("VALIDATION_ERROR", "Data końcowa jest niepoprawna.");
    }
    if (end && end < start) {
      return error("VALIDATION_ERROR", "Koniec nie może być przed początkiem.");
    }

    if (input.calendarSourceId?.startsWith("google:")) {
      try {
        return success(
          await createGoogleEvent(
            context.env,
            auth.member,
            input.calendarSourceId,
            {
              title,
              description: description ?? null,
              type,
              startDate: start,
              endDate: end ?? null,
              allDay,
              calendarSourceId: input.calendarSourceId,
            },
          ),
          { status: 201 },
        );
      } catch (reason) {
        if (reason instanceof CalendarPermissionError) {
          return error(
            "FORBIDDEN",
            "Nie masz uprawnień do dodawania wydarzeń w tym kalendarzu.",
            403,
          );
        }
        if (reason instanceof CalendarIntegrationUnavailableError) {
          return error(
            "NOT_CONFIGURED",
            "Integracja z Kalendarzem Google nie jest dostępna.",
            503,
          );
        }
        console.error(
          `Google event creation failed for member ${auth.member.id}, calendar ${input.calendarSourceId} (${describeGoogleCalendarError(reason)}).`,
        );
        return error(
          "SERVICE_UNAVAILABLE",
          "Nie udało się utworzyć wydarzenia w Kalendarzu Google.",
          502,
        );
      }
    }
    if (input.calendarSourceId && input.calendarSourceId !== "local") {
      return error("VALIDATION_ERROR", "Wybrany kalendarz nie istnieje.");
    }

    const id = crypto.randomUUID();
    const timestamp = nowIso();
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
