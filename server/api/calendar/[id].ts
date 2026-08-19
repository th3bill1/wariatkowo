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
import {
  CalendarConflictError,
  CalendarIntegrationUnavailableError,
  CalendarPermissionError,
  deleteGoogleEvent,
  getGoogleEvent,
  updateGoogleEvent,
} from "../../googleCalendar/data";
import { describeGoogleCalendarError } from "../../googleCalendar/client";

const select =
  "SELECT " +
  CALENDAR_COLUMNS +
  " FROM calendar_events e JOIN household_members m ON m.id=e.created_by_member_id";

function googleMutationError(reason: unknown, operation: "edit" | "delete") {
  if (reason instanceof CalendarPermissionError) {
    return error(
      "FORBIDDEN",
      operation === "delete"
        ? "Tego wydarzenia Google nie można usunąć."
        : "Tego wydarzenia Google nie można edytować.",
      403,
    );
  }
  if (reason instanceof CalendarConflictError) {
    return error(
      "CONFLICT",
      "To wydarzenie zostało zmienione w Kalendarzu Google. Odświeżono jego najnowszą wersję.",
      409,
    );
  }
  if (reason instanceof CalendarIntegrationUnavailableError) {
    return error(
      "NOT_CONFIGURED",
      "Integracja z Kalendarzem Google nie jest dostępna.",
      503,
    );
  }
  return error(
    "SERVICE_UNAVAILABLE",
    operation === "delete"
      ? "Nie udało się usunąć wydarzenia z Kalendarza Google."
      : "Nie udało się zaktualizować wydarzenia w Kalendarzu Google.",
    502,
  );
}

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
  const googleExisting = existing
    ? null
    : await getGoogleEvent(context.env, id);
  if (!existing && !googleExisting) {
    return error("NOT_FOUND", "Nie znaleziono wydarzenia.", 404);
  }

  if (context.request.method === "DELETE") {
    if (googleExisting) {
      try {
        await deleteGoogleEvent(context.env, googleExisting);
        return new Response(null, { status: 204 });
      } catch (reason) {
        console.error(
          `Google event deletion failed for event ${id}, calendar ${googleExisting.event.calendarSourceId} (${describeGoogleCalendarError(reason)}).`,
        );
        return googleMutationError(reason, "delete");
      }
    }
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
    const input = body as UpdateCalendarEventInput;
    const currentEvent = googleExisting?.event;
    const allDay =
      input.allDay ?? currentEvent?.allDay ?? Boolean(existing?.all_day);
    const title =
      input.title === undefined
        ? (currentEvent?.title ?? existing!.title)
        : parseTrimmedString(input.title);
    const description =
      input.description === undefined
        ? currentEvent
          ? currentEvent.description
          : existing!.description
        : parseOptionalString(input.description);
    const type = input.type ?? currentEvent?.type ?? existing!.type;
    const start =
      input.startDate === undefined
        ? parseCalendarDate(
            currentEvent?.startDate ?? existing!.start_date,
            allDay,
          )
        : parseCalendarDate(input.startDate, allDay);
    const rawEnd =
      input.endDate === undefined
        ? currentEvent
          ? currentEvent.endDate
          : existing!.end_date
        : input.endDate;
    const end = rawEnd ? parseCalendarDate(rawEnd, allDay) : null;
    if (
      !title ||
      title.length > 180 ||
      !isCalendarEventType(type) ||
      !start ||
      (rawEnd && end === undefined) ||
      (end && end < start)
    ) {
      return error("VALIDATION_ERROR", "Dane wydarzenia są niepoprawne.");
    }

    if (googleExisting) {
      try {
        return success(
          await updateGoogleEvent(context.env, googleExisting, input, {
            title,
            description: description ?? null,
            type,
            startDate: start,
            endDate: end ?? null,
            allDay,
          }),
        );
      } catch (reason) {
        console.error(
          `Google event update failed for event ${id}, calendar ${googleExisting.event.calendarSourceId} (${describeGoogleCalendarError(reason)}).`,
        );
        return googleMutationError(reason, "edit");
      }
    }

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
