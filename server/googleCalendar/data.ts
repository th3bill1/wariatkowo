import type {
  CalendarEvent,
  CalendarEventType,
  CalendarSource,
  CreateCalendarEventInput,
  GoogleCalendarConnectionStatus,
  HouseholdMember,
  UpdateCalendarEventInput,
} from "../../shared/models";
import { nowIso, type Env } from "../_shared/http";
import {
  GoogleCalendarApiError,
  type GoogleCalendarAccessRole,
  type GoogleCalendarEventResource,
  type GoogleEventPerson,
} from "./client";
import {
  ACCESS_ROLE_RANK,
  cacheGoogleEvent,
  calendarRoleCanCreate,
  eventCanMutate,
  recomputeCalendarAfterAccessChange,
  syncCalendar,
} from "./sync";

type GoogleEventRow = {
  id: string;
  google_calendar_id: string;
  google_event_id: string;
  etag: string | null;
  summary: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  all_day: number;
  time_zone: string | null;
  organizer_json: string | null;
  attendees_json: string | null;
  html_link: string | null;
  hangout_link: string | null;
  event_type: string | null;
  visibility: string | null;
  recurrence_json: string | null;
  recurring_event_id: string | null;
  extended_properties_json: string | null;
  locked: number;
  wariatkowo_type: CalendarEventType;
  google_updated_at: string | null;
  created_at: string;
  updated_at: string;
  calendar_summary: string;
  background_color: string | null;
  preferred_member_id: string;
  preferred_member_name: string;
  access_role: GoogleCalendarAccessRole;
  summary_override: string | null;
  access_background_color: string | null;
  connection_status: "connected" | "error";
};

type WritableAccess = {
  connection_id: string;
  encrypted_refresh_token: string;
  access_role: GoogleCalendarAccessRole;
};

const GOOGLE_EVENT_SELECT = `SELECT
  e.id,e.google_calendar_id,e.google_event_id,e.etag,e.summary,e.description,e.location,
  e.start_date,e.end_date,e.all_day,e.time_zone,e.organizer_json,e.attendees_json,
  e.html_link,e.hangout_link,e.event_type,e.visibility,e.recurrence_json,e.recurring_event_id,
  e.extended_properties_json,e.locked,e.wariatkowo_type,e.google_updated_at,e.created_at,e.updated_at,
  g.summary AS calendar_summary,g.background_color,
  m.id AS preferred_member_id,m.name AS preferred_member_name,
  a.access_role,a.summary_override,a.background_color AS access_background_color,
  c.status AS connection_status
 FROM google_calendar_events e
 JOIN google_calendars g ON g.calendar_id=e.google_calendar_id
 JOIN google_calendar_access a
   ON a.calendar_id=g.calendar_id AND a.connection_id=g.preferred_connection_id AND a.active=1
 JOIN google_calendar_connections c ON c.id=a.connection_id AND c.status IN ('connected','error')
 JOIN household_members m ON m.id=c.member_id`;

function parsedJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function publicPerson(person: GoogleEventPerson): GoogleEventPerson {
  return {
    email: person.email,
    displayName: person.displayName,
    self: person.self,
    responseStatus: person.responseStatus,
  };
}

export function toGoogleCalendarEvent(row: GoogleEventRow): CalendarEvent {
  const mutable =
    row.connection_status === "connected" &&
    eventCanMutate(row.access_role, {
      locked: Boolean(row.locked),
      visibility: row.visibility,
      eventType: row.event_type,
      recurringEventId: row.recurring_event_id,
      recurrence: Boolean(row.recurrence_json),
    });
  const organizer = parsedJson<GoogleEventPerson | null>(
    row.organizer_json,
    null,
  );
  return {
    id: row.id,
    title: row.summary,
    description: row.description,
    type: row.wariatkowo_type,
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: Boolean(row.all_day),
    createdByMemberId: row.preferred_member_id,
    createdByName: row.preferred_member_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: "google",
    calendarSourceId: `google:${row.google_calendar_id}`,
    calendarName: row.summary_override ?? row.calendar_summary,
    sourceOwnerName: row.preferred_member_name,
    calendarColor: row.access_background_color ?? row.background_color,
    location: row.location,
    organizer: organizer ? publicPerson(organizer) : null,
    attendees: parsedJson<GoogleEventPerson[]>(row.attendees_json, []).map(
      publicPerson,
    ),
    htmlLink: row.html_link,
    hangoutLink: row.hangout_link,
    timeZone: row.time_zone,
    eventType: row.event_type,
    recurring: Boolean(row.recurrence_json || row.recurring_event_id),
    canEdit: mutable,
    canDelete: mutable,
  };
}

export async function listGoogleEvents(
  env: Env,
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  const rows = await env.DB.prepare(
    `${GOOGLE_EVENT_SELECT}
     WHERE e.start_date <= ? AND COALESCE(e.end_date,e.start_date) >= ?
     ORDER BY e.start_date ASC`,
  )
    .bind(to, from)
    .all<GoogleEventRow>();
  return rows.results.map(toGoogleCalendarEvent);
}

export async function getGoogleEvent(
  env: Env,
  id: string,
): Promise<{ row: GoogleEventRow; event: CalendarEvent } | null> {
  const row = await env.DB.prepare(`${GOOGLE_EVENT_SELECT} WHERE e.id=?`)
    .bind(id)
    .first<GoogleEventRow>();
  return row ? { row, event: toGoogleCalendarEvent(row) } : null;
}

type SourceAccessRow = {
  calendar_id: string;
  calendar_summary: string;
  calendar_background_color: string | null;
  calendar_foreground_color: string | null;
  member_name: string;
  access_role: GoogleCalendarAccessRole;
  is_primary: number;
  selected: number;
  hidden: number;
  summary_override: string | null;
  background_color: string | null;
  foreground_color: string | null;
  last_error: string | null;
  connection_status: "connected" | "error";
};

export async function listCalendarSources(env: Env): Promise<CalendarSource[]> {
  const rows = await env.DB.prepare(
    `SELECT g.calendar_id,g.summary AS calendar_summary,
            g.background_color AS calendar_background_color,
            g.foreground_color AS calendar_foreground_color,
            m.name AS member_name,a.access_role,a.is_primary,a.selected,a.hidden,
            a.summary_override,a.background_color,a.foreground_color,a.last_error,
            c.status AS connection_status
     FROM google_calendar_access a
     JOIN google_calendars g ON g.calendar_id=a.calendar_id
     JOIN google_calendar_connections c ON c.id=a.connection_id
     JOIN household_members m ON m.id=c.member_id
     WHERE a.active=1 AND c.status IN ('connected','error')
     ORDER BY m.name,g.summary`,
  ).all<SourceAccessRow>();
  const grouped = new Map<string, SourceAccessRow[]>();
  for (const row of rows.results) {
    grouped.set(row.calendar_id, [
      ...(grouped.get(row.calendar_id) ?? []),
      row,
    ]);
  }
  const googleSources = Array.from(grouped.entries()).map(([id, accesses]) => {
    const best = [...accesses].sort(
      (first, second) =>
        ACCESS_ROLE_RANK[second.access_role] -
        ACCESS_ROLE_RANK[first.access_role],
    )[0];
    const ownerNames = Array.from(
      new Set(accesses.map((row) => row.member_name)),
    );
    return {
      id: `google:${id}`,
      kind: "google" as const,
      name: best.summary_override ?? best.calendar_summary,
      ownerNames,
      ownerLabel: ownerNames.length > 1 ? "Wspólne" : ownerNames[0],
      accessRole: best.access_role,
      writable: accesses.some(
        (row) =>
          row.connection_status === "connected" &&
          calendarRoleCanCreate(row.access_role),
      ),
      primary: accesses.some((row) => Boolean(row.is_primary)),
      selected: accesses.some((row) => Boolean(row.selected) && !row.hidden),
      hidden: accesses.every((row) => Boolean(row.hidden)),
      backgroundColor: best.background_color ?? best.calendar_background_color,
      foregroundColor: best.foreground_color ?? best.calendar_foreground_color,
      syncError: accesses.find((row) => row.last_error)?.last_error ?? null,
    } satisfies CalendarSource;
  });
  return [
    {
      id: "local",
      kind: "local",
      name: "Lokalne",
      ownerNames: ["Wariatkowo"],
      ownerLabel: "Wariatkowo",
      accessRole: null,
      writable: true,
      primary: false,
      selected: true,
      hidden: false,
      backgroundColor: "#7c5caf",
      foregroundColor: "#ffffff",
      syncError: null,
    },
    ...googleSources.sort(
      (first, second) =>
        first.ownerLabel.localeCompare(second.ownerLabel, "pl") ||
        first.name.localeCompare(second.name, "pl"),
    ),
  ];
}

export async function getConnectionStatus(
  env: Env,
  memberId: string,
): Promise<GoogleCalendarConnectionStatus> {
  const row = await env.DB.prepare(
    `SELECT c.google_email,c.status,c.last_sync_at,c.last_error,
            COUNT(CASE WHEN a.active=1 THEN 1 END) AS calendar_count
     FROM google_calendar_connections c
     LEFT JOIN google_calendar_access a ON a.connection_id=c.id
     WHERE c.member_id=?
     GROUP BY c.id`,
  )
    .bind(memberId)
    .first<{
      google_email: string;
      status: "connected" | "needs_reconnect" | "error";
      last_sync_at: string | null;
      last_error: string | null;
      calendar_count: number;
    }>();
  if (!row) {
    return {
      connected: false,
      status: "disconnected",
      email: null,
      calendarCount: 0,
      lastSyncAt: null,
      message: null,
    };
  }
  return {
    connected: row.status === "connected",
    status: row.status,
    email: row.google_email,
    calendarCount: Number(row.calendar_count),
    lastSyncAt: row.last_sync_at,
    message: row.last_error,
  };
}

async function writableAccess(
  env: Env,
  calendarId: string,
  event?: GoogleEventRow,
): Promise<WritableAccess | null> {
  const rows = await env.DB.prepare(
    `SELECT a.connection_id,c.encrypted_refresh_token,a.access_role
     FROM google_calendar_access a
     JOIN google_calendar_connections c ON c.id=a.connection_id
     WHERE a.calendar_id=? AND a.active=1 AND c.status='connected'`,
  )
    .bind(calendarId)
    .all<WritableAccess>();
  rows.results.sort(
    (first, second) =>
      ACCESS_ROLE_RANK[second.access_role] -
      ACCESS_ROLE_RANK[first.access_role],
  );
  return (
    rows.results.find((row) =>
      event
        ? eventCanMutate(row.access_role, {
            locked: Boolean(event.locked),
            visibility: event.visibility,
            eventType: event.event_type,
            recurringEventId: event.recurring_event_id,
            recurrence: Boolean(event.recurrence_json),
          })
        : calendarRoleCanCreate(row.access_role),
    ) ?? null
  );
}

function refreshToken(env: Env, access: WritableAccess): string {
  const integration = env.GOOGLE_CALENDAR;
  if (!integration) throw new CalendarIntegrationUnavailableError();
  return integration.tokenCipher.decrypt(access.encrypted_refresh_token);
}

function nextDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function googleDates(input: {
  startDate: string;
  endDate?: string | null;
  allDay?: boolean;
}): Pick<GoogleCalendarEventResource, "start" | "end"> {
  if (input.allDay ?? true) {
    return {
      start: { date: input.startDate.slice(0, 10) },
      end: { date: nextDate((input.endDate ?? input.startDate).slice(0, 10)) },
    };
  }
  const start = new Date(input.startDate);
  const end = input.endDate
    ? new Date(input.endDate)
    : new Date(start.getTime() + 60 * 60_000);
  return {
    start: { dateTime: start.toISOString(), timeZone: "Europe/Warsaw" },
    end: { dateTime: end.toISOString(), timeZone: "Europe/Warsaw" },
  };
}

async function markAuthFailure(
  env: Env,
  connectionId: string,
  error: unknown,
): Promise<void> {
  if (
    !(error instanceof GoogleCalendarApiError) ||
    !error.isAuthenticationError
  )
    return;
  await env.DB.prepare(
    "UPDATE google_calendar_connections SET status='needs_reconnect',last_error=?,updated_at=? WHERE id=?",
  )
    .bind("Połączenie z Kalendarzem Google wygasło.", nowIso(), connectionId)
    .run();
  const calendars = await env.DB.prepare(
    "SELECT calendar_id FROM google_calendar_access WHERE connection_id=? AND active=1",
  )
    .bind(connectionId)
    .all<{ calendar_id: string }>();
  for (const calendar of calendars.results) {
    await recomputeCalendarAfterAccessChange(env, calendar.calendar_id).catch(
      () => undefined,
    );
  }
}

export class CalendarPermissionError extends Error {}
export class CalendarConflictError extends Error {}
export class CalendarIntegrationUnavailableError extends Error {}

export async function createGoogleEvent(
  env: Env,
  member: HouseholdMember,
  calendarSourceId: string,
  input: CreateCalendarEventInput,
): Promise<CalendarEvent> {
  const integration = env.GOOGLE_CALENDAR;
  if (!integration) throw new CalendarIntegrationUnavailableError();
  const calendarId = calendarSourceId.startsWith("google:")
    ? calendarSourceId.slice("google:".length)
    : "";
  if (!calendarId) throw new CalendarPermissionError();
  const access = await writableAccess(env, calendarId);
  if (!access) throw new CalendarPermissionError();
  const resource: Partial<GoogleCalendarEventResource> = {
    summary: input.title,
    description: input.description ?? undefined,
    ...googleDates(input),
    extendedProperties: {
      private: {
        wariatkowoType: input.type ?? "event",
        wariatkowoCreator: member.slug,
      },
    },
  };
  try {
    const created = await integration.client.insertEvent(
      refreshToken(env, access),
      calendarId,
      resource,
    );
    await cacheGoogleEvent(env, calendarId, created);
    const cached = await env.DB.prepare(
      `${GOOGLE_EVENT_SELECT} WHERE e.google_calendar_id=? AND e.google_event_id=?`,
    )
      .bind(calendarId, created.id)
      .first<GoogleEventRow>();
    if (!cached) throw new Error("Google event was not cached.");
    return toGoogleCalendarEvent(cached);
  } catch (error) {
    if (
      error instanceof GoogleCalendarApiError &&
      [403, 404].includes(error.status)
    ) {
      await syncCalendar(env, calendarId).catch(() => undefined);
      throw new CalendarPermissionError();
    }
    await markAuthFailure(env, access.connection_id, error);
    throw error;
  }
}

function mergedExtendedProperties(
  row: GoogleEventRow,
  type: CalendarEventType,
): GoogleCalendarEventResource["extendedProperties"] {
  const current = parsedJson<
    NonNullable<GoogleCalendarEventResource["extendedProperties"]>
  >(row.extended_properties_json, {});
  return {
    ...current,
    private: { ...current.private, wariatkowoType: type },
  };
}

export async function updateGoogleEvent(
  env: Env,
  current: { row: GoogleEventRow; event: CalendarEvent },
  input: UpdateCalendarEventInput,
  normalized: {
    title: string;
    description: string | null;
    type: CalendarEventType;
    startDate: string;
    endDate: string | null;
    allDay: boolean;
  },
): Promise<CalendarEvent> {
  const integration = env.GOOGLE_CALENDAR;
  if (!integration) throw new CalendarIntegrationUnavailableError();
  const access = await writableAccess(
    env,
    current.row.google_calendar_id,
    current.row,
  );
  if (!access) throw new CalendarPermissionError();
  const patch: Partial<GoogleCalendarEventResource> = {};
  if (input.title !== undefined) patch.summary = normalized.title;
  if (input.description !== undefined)
    patch.description = normalized.description ?? "";
  if (input.type !== undefined)
    patch.extendedProperties = mergedExtendedProperties(
      current.row,
      normalized.type,
    );
  if (
    input.startDate !== undefined ||
    input.endDate !== undefined ||
    input.allDay !== undefined
  ) {
    Object.assign(
      patch,
      googleDates({
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        allDay: normalized.allDay,
      }),
    );
  }
  try {
    const updated = await integration.client.patchEvent(
      refreshToken(env, access),
      current.row.google_calendar_id,
      current.row.google_event_id,
      patch,
      current.row.etag,
    );
    await cacheGoogleEvent(env, current.row.google_calendar_id, updated);
    const cached = await getGoogleEvent(env, current.row.id);
    if (!cached) throw new Error("Updated Google event was not cached.");
    return cached.event;
  } catch (error) {
    if (error instanceof GoogleCalendarApiError && error.status === 412) {
      const latest = await integration.client.getEvent(
        refreshToken(env, access),
        current.row.google_calendar_id,
        current.row.google_event_id,
      );
      await cacheGoogleEvent(env, current.row.google_calendar_id, latest);
      throw new CalendarConflictError();
    }
    if (
      error instanceof GoogleCalendarApiError &&
      [403, 404].includes(error.status)
    ) {
      await syncCalendar(env, current.row.google_calendar_id).catch(
        () => undefined,
      );
      throw new CalendarPermissionError();
    }
    await markAuthFailure(env, access.connection_id, error);
    throw error;
  }
}

export async function deleteGoogleEvent(
  env: Env,
  current: { row: GoogleEventRow; event: CalendarEvent },
): Promise<void> {
  const integration = env.GOOGLE_CALENDAR;
  if (!integration) throw new CalendarIntegrationUnavailableError();
  const access = await writableAccess(
    env,
    current.row.google_calendar_id,
    current.row,
  );
  if (!access) throw new CalendarPermissionError();
  try {
    await integration.client.deleteEvent(
      refreshToken(env, access),
      current.row.google_calendar_id,
      current.row.google_event_id,
      current.row.etag,
    );
  } catch (error) {
    if (!(error instanceof GoogleCalendarApiError && error.status === 404)) {
      if (error instanceof GoogleCalendarApiError && error.status === 412) {
        await syncCalendar(env, current.row.google_calendar_id).catch(
          () => undefined,
        );
        throw new CalendarConflictError();
      }
      if (error instanceof GoogleCalendarApiError && error.status === 403) {
        await syncCalendar(env, current.row.google_calendar_id).catch(
          () => undefined,
        );
        throw new CalendarPermissionError();
      }
      await markAuthFailure(env, access.connection_id, error);
      throw error;
    }
  }
  await env.DB.prepare("DELETE FROM google_calendar_events WHERE id=?")
    .bind(current.row.id)
    .run();
}
