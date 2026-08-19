import type { CalendarEventType } from "../../shared/models";
import { nowIso, type Env } from "../_shared/http";
import { CALENDAR_EVENT_TYPES } from "../_shared/calendar";
import {
  describeGoogleCalendarError,
  GoogleCalendarApiError,
  type GoogleCalendarAccessRole,
  type GoogleCalendarEntry,
  type GoogleCalendarEventResource,
} from "./client";

type ConnectionRow = {
  id: string;
  member_id: string;
  encrypted_refresh_token: string;
  calendar_list_sync_token: string | null;
  status: "connected" | "needs_reconnect" | "error";
};

type PreferredAccessRow = ConnectionRow & {
  calendar_id: string;
  access_role: GoogleCalendarAccessRole;
  event_sync_token: string | null;
};

const connectionLocks = new Map<string, Promise<void>>();
const calendarLocks = new Map<string, Promise<void>>();

export const ACCESS_ROLE_RANK: Record<GoogleCalendarAccessRole, number> = {
  owner: 5,
  writer: 4,
  writerWithoutPrivateAccess: 3,
  reader: 2,
  freeBusyReader: 1,
};

export function normalizeAccessRole(
  value: string | undefined,
): GoogleCalendarAccessRole {
  return value && Object.prototype.hasOwnProperty.call(ACCESS_ROLE_RANK, value)
    ? (value as GoogleCalendarAccessRole)
    : "freeBusyReader";
}

export function calendarRoleCanCreate(role: GoogleCalendarAccessRole): boolean {
  return (
    role === "owner" ||
    role === "writer" ||
    role === "writerWithoutPrivateAccess"
  );
}

export function eventCanMutate(
  role: GoogleCalendarAccessRole,
  event: {
    locked: boolean;
    visibility: string | null;
    eventType: string | null;
    recurringEventId?: string | null;
    recurrence?: boolean;
  },
): boolean {
  if (
    !calendarRoleCanCreate(role) ||
    event.locked ||
    event.recurringEventId ||
    event.recurrence
  )
    return false;
  if (role === "writerWithoutPrivateAccess" && event.visibility === "private")
    return false;
  return !["birthday", "fromGmail", "workingLocation"].includes(
    event.eventType ?? "default",
  );
}

function isGone(error: unknown): boolean {
  return error instanceof GoogleCalendarApiError && error.status === 410;
}

async function connectionRow(
  env: Env,
  id: string,
): Promise<ConnectionRow | null> {
  return env.DB.prepare(
    "SELECT id,member_id,encrypted_refresh_token,calendar_list_sync_token,status FROM google_calendar_connections WHERE id=?",
  )
    .bind(id)
    .first<ConnectionRow>();
}

function decryptedToken(env: Env, connection: ConnectionRow): string {
  const integration = env.GOOGLE_CALENDAR;
  if (!integration) throw new Error("Google Calendar is not configured.");
  return integration.tokenCipher.decrypt(connection.encrypted_refresh_token);
}

async function markConnectionFailure(
  env: Env,
  connectionId: string,
  error: unknown,
): Promise<void> {
  const authFailure =
    error instanceof GoogleCalendarApiError && error.isAuthenticationError;
  await env.DB.prepare(
    "UPDATE google_calendar_connections SET status=?,last_error=?,updated_at=? WHERE id=?",
  )
    .bind(
      authFailure ? "needs_reconnect" : "error",
      authFailure
        ? "Połączenie z Kalendarzem Google wygasło."
        : "Nie udało się zsynchronizować listy kalendarzy.",
      nowIso(),
      connectionId,
    )
    .run();
  if (authFailure) {
    const calendars = await env.DB.prepare(
      "SELECT calendar_id FROM google_calendar_access WHERE connection_id=? AND active=1",
    )
      .bind(connectionId)
      .all<{ calendar_id: string }>();
    for (const calendar of calendars.results) {
      await recomputePreferredConnection(env, calendar.calendar_id);
    }
  }
}

async function upsertCalendarEntry(
  env: Env,
  connectionId: string,
  entry: GoogleCalendarEntry,
): Promise<void> {
  if (!entry.id) return;
  const timestamp = nowIso();
  if (entry.deleted) {
    await env.DB.prepare(
      "UPDATE google_calendar_access SET active=0,event_sync_token=NULL,updated_at=? WHERE connection_id=? AND calendar_id=?",
    )
      .bind(timestamp, connectionId, entry.id)
      .run();
    return;
  }
  await env.DB.prepare(
    `INSERT INTO google_calendars
      (calendar_id,summary,description,time_zone,background_color,foreground_color,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(calendar_id) DO UPDATE SET
       summary=excluded.summary,
       description=excluded.description,
       time_zone=excluded.time_zone,
       background_color=excluded.background_color,
       foreground_color=excluded.foreground_color,
       updated_at=excluded.updated_at`,
  )
    .bind(
      entry.id,
      entry.summary?.trim() || "Kalendarz Google",
      entry.description ?? null,
      entry.timeZone ?? null,
      entry.backgroundColor ?? null,
      entry.foregroundColor ?? null,
      timestamp,
      timestamp,
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO google_calendar_access
      (connection_id,calendar_id,access_role,is_primary,selected,hidden,active,summary_override,background_color,foreground_color,updated_at)
     VALUES (?,?,?,?,?,?,1,?,?,?,?)
     ON CONFLICT(connection_id,calendar_id) DO UPDATE SET
       access_role=excluded.access_role,
       is_primary=excluded.is_primary,
       selected=excluded.selected,
       hidden=excluded.hidden,
       active=1,
       summary_override=excluded.summary_override,
       background_color=excluded.background_color,
       foreground_color=excluded.foreground_color,
       updated_at=excluded.updated_at,
       last_error=NULL`,
  )
    .bind(
      connectionId,
      entry.id,
      normalizeAccessRole(entry.accessRole),
      entry.primary ? 1 : 0,
      entry.selected === false ? 0 : 1,
      entry.hidden ? 1 : 0,
      entry.summaryOverride ?? null,
      entry.backgroundColor ?? null,
      entry.foregroundColor ?? null,
      timestamp,
    )
    .run();
}

async function recomputePreferredConnection(
  env: Env,
  calendarId: string,
): Promise<boolean> {
  const calendar = await env.DB.prepare(
    "SELECT preferred_connection_id FROM google_calendars WHERE calendar_id=?",
  )
    .bind(calendarId)
    .first<{ preferred_connection_id: string | null }>();
  if (!calendar) return false;
  const accesses = await env.DB.prepare(
    `SELECT a.connection_id,a.access_role
     FROM google_calendar_access a
     JOIN google_calendar_connections c ON c.id=a.connection_id
     WHERE a.calendar_id=? AND a.active=1 AND c.status='connected'`,
  )
    .bind(calendarId)
    .all<{ connection_id: string; access_role: GoogleCalendarAccessRole }>();
  accesses.results.sort(
    (first, second) =>
      ACCESS_ROLE_RANK[second.access_role] -
        ACCESS_ROLE_RANK[first.access_role] ||
      first.connection_id.localeCompare(second.connection_id),
  );
  const preferred = accesses.results[0]?.connection_id ?? null;
  if (preferred === calendar.preferred_connection_id) return false;
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE google_calendars SET preferred_connection_id=?,updated_at=? WHERE calendar_id=?",
    ).bind(preferred, nowIso(), calendarId),
    env.DB.prepare(
      "UPDATE google_calendar_access SET event_sync_token=NULL WHERE calendar_id=?",
    ).bind(calendarId),
  ]);
  if (!preferred) {
    await env.DB.prepare(
      "DELETE FROM google_calendar_events WHERE google_calendar_id=?",
    )
      .bind(calendarId)
      .run();
  }
  return true;
}

function previousDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function eventType(event: GoogleCalendarEventResource): CalendarEventType {
  const candidate = event.extendedProperties?.private?.wariatkowoType;
  return CALENDAR_EVENT_TYPES.includes(candidate as CalendarEventType)
    ? (candidate as CalendarEventType)
    : "event";
}

export function googleEventDates(event: GoogleCalendarEventResource): {
  start: string;
  end: string | null;
  allDay: boolean;
  timeZone: string | null;
} | null {
  if (event.start?.date) {
    return {
      start: event.start.date,
      end: event.end?.date ? previousDate(event.end.date) : null,
      allDay: true,
      timeZone: event.start.timeZone ?? event.end?.timeZone ?? null,
    };
  }
  if (!event.start?.dateTime) return null;
  const start = new Date(event.start.dateTime);
  if (Number.isNaN(start.getTime())) return null;
  const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
  return {
    start: start.toISOString(),
    end: end && !Number.isNaN(end.getTime()) ? end.toISOString() : null,
    allDay: false,
    timeZone: event.start.timeZone ?? event.end?.timeZone ?? null,
  };
}

export async function cacheGoogleEvent(
  env: Env,
  calendarId: string,
  event: GoogleCalendarEventResource,
): Promise<void> {
  if (!event.id) return;
  if (event.status === "cancelled") {
    await env.DB.prepare(
      "DELETE FROM google_calendar_events WHERE google_calendar_id=? AND google_event_id=?",
    )
      .bind(calendarId, event.id)
      .run();
    return;
  }
  const dates = googleEventDates(event);
  if (!dates) return;
  const timestamp = nowIso();
  await env.DB.prepare(
    `INSERT INTO google_calendar_events
      (id,google_calendar_id,google_event_id,etag,status,summary,description,location,start_date,end_date,all_day,time_zone,
       organizer_json,attendees_json,html_link,hangout_link,event_type,visibility,recurrence_json,recurring_event_id,
       original_start_time,extended_properties_json,locked,wariatkowo_type,google_updated_at,last_synced_at,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(google_calendar_id,google_event_id) DO UPDATE SET
       etag=excluded.etag,status=excluded.status,summary=excluded.summary,description=excluded.description,
       location=excluded.location,start_date=excluded.start_date,end_date=excluded.end_date,all_day=excluded.all_day,
       time_zone=excluded.time_zone,organizer_json=excluded.organizer_json,attendees_json=excluded.attendees_json,
       html_link=excluded.html_link,hangout_link=excluded.hangout_link,event_type=excluded.event_type,
       visibility=excluded.visibility,recurrence_json=excluded.recurrence_json,recurring_event_id=excluded.recurring_event_id,
       original_start_time=excluded.original_start_time,extended_properties_json=excluded.extended_properties_json,
       locked=excluded.locked,wariatkowo_type=excluded.wariatkowo_type,google_updated_at=excluded.google_updated_at,
       last_synced_at=excluded.last_synced_at,updated_at=excluded.updated_at`,
  )
    .bind(
      crypto.randomUUID(),
      calendarId,
      event.id,
      event.etag ?? null,
      event.status ?? "confirmed",
      event.summary?.trim() || "(bez tytułu)",
      event.description ?? null,
      event.location ?? null,
      dates.start,
      dates.end,
      dates.allDay ? 1 : 0,
      dates.timeZone,
      event.organizer ? JSON.stringify(event.organizer) : null,
      event.attendees ? JSON.stringify(event.attendees) : null,
      event.htmlLink ?? null,
      event.hangoutLink ?? null,
      event.eventType ?? "default",
      event.visibility ?? "default",
      event.recurrence ? JSON.stringify(event.recurrence) : null,
      event.recurringEventId ?? null,
      event.originalStartTime ? JSON.stringify(event.originalStartTime) : null,
      event.extendedProperties
        ? JSON.stringify(event.extendedProperties)
        : null,
      event.locked ? 1 : 0,
      eventType(event),
      event.updated ?? null,
      timestamp,
      timestamp,
      timestamp,
    )
    .run();
}

async function preferredAccess(
  env: Env,
  calendarId: string,
): Promise<PreferredAccessRow | null> {
  return env.DB.prepare(
    `SELECT c.id,c.member_id,c.encrypted_refresh_token,c.calendar_list_sync_token,c.status,
            a.calendar_id,a.access_role,a.event_sync_token
     FROM google_calendars g
     JOIN google_calendar_access a
       ON a.calendar_id=g.calendar_id AND a.connection_id=g.preferred_connection_id
     JOIN google_calendar_connections c ON c.id=a.connection_id
     WHERE g.calendar_id=? AND a.active=1 AND c.status='connected'`,
  )
    .bind(calendarId)
    .first<PreferredAccessRow>();
}

async function syncCalendarUnlocked(
  env: Env,
  calendarId: string,
  forceFull: boolean,
): Promise<void> {
  const integration = env.GOOGLE_CALENDAR;
  if (!integration) throw new Error("Google Calendar is not configured.");
  const access = await preferredAccess(env, calendarId);
  if (!access) return;
  const refreshToken = decryptedToken(env, access);
  const syncToken = forceFull
    ? undefined
    : (access.event_sync_token ?? undefined);
  const events: GoogleCalendarEventResource[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  try {
    do {
      const page = await integration.client.listEvents(
        refreshToken,
        calendarId,
        {
          pageToken,
          syncToken,
        },
      );
      events.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
  } catch (error) {
    if (syncToken && isGone(error)) {
      await env.DB.prepare(
        "UPDATE google_calendar_access SET event_sync_token=NULL WHERE connection_id=? AND calendar_id=?",
      )
        .bind(access.id, calendarId)
        .run();
      await syncCalendarUnlocked(env, calendarId, true);
      return;
    }
    await env.DB.prepare(
      "UPDATE google_calendar_access SET last_error=? WHERE connection_id=? AND calendar_id=?",
    )
      .bind("Nie udało się zsynchronizować wydarzeń.", access.id, calendarId)
      .run();
    if (
      error instanceof GoogleCalendarApiError &&
      error.isAuthenticationError
    ) {
      await markConnectionFailure(env, access.id, error);
    }
    throw error;
  }

  if (!syncToken) {
    await env.DB.prepare(
      "DELETE FROM google_calendar_events WHERE google_calendar_id=?",
    )
      .bind(calendarId)
      .run();
  }
  for (const event of events) await cacheGoogleEvent(env, calendarId, event);
  await env.DB.prepare(
    "UPDATE google_calendar_access SET event_sync_token=?,last_sync_at=?,last_error=NULL WHERE connection_id=? AND calendar_id=?",
  )
    .bind(nextSyncToken ?? null, nowIso(), access.id, calendarId)
    .run();
}

export function syncCalendar(
  env: Env,
  calendarId: string,
  options: { forceFull?: boolean } = {},
): Promise<void> {
  const current = calendarLocks.get(calendarId);
  if (current) return current;
  const promise = syncCalendarUnlocked(
    env,
    calendarId,
    options.forceFull ?? false,
  ).finally(() => calendarLocks.delete(calendarId));
  calendarLocks.set(calendarId, promise);
  return promise;
}

async function syncConnectionUnlocked(
  env: Env,
  connectionId: string,
  forceFull: boolean,
): Promise<void> {
  const integration = env.GOOGLE_CALENDAR;
  if (!integration) throw new Error("Google Calendar is not configured.");
  const connection = await connectionRow(env, connectionId);
  if (!connection) return;
  const refreshToken = decryptedToken(env, connection);
  const syncToken = forceFull
    ? undefined
    : (connection.calendar_list_sync_token ?? undefined);
  const entries: GoogleCalendarEntry[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  try {
    do {
      const page = await integration.client.listCalendars(refreshToken, {
        pageToken,
        syncToken,
      });
      entries.push(...(page.items ?? []));
      pageToken = page.nextPageToken;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);
  } catch (error) {
    if (syncToken && isGone(error)) {
      await env.DB.prepare(
        "UPDATE google_calendar_connections SET calendar_list_sync_token=NULL WHERE id=?",
      )
        .bind(connectionId)
        .run();
      await syncConnectionUnlocked(env, connectionId, true);
      return;
    }
    await markConnectionFailure(env, connectionId, error);
    throw error;
  }

  if (!syncToken) {
    await env.DB.prepare(
      "UPDATE google_calendar_access SET active=0 WHERE connection_id=?",
    )
      .bind(connectionId)
      .run();
  }
  for (const entry of entries)
    await upsertCalendarEntry(env, connectionId, entry);
  await env.DB.prepare(
    "UPDATE google_calendar_connections SET calendar_list_sync_token=?,status='connected',last_error=NULL,updated_at=? WHERE id=?",
  )
    .bind(nextSyncToken ?? null, nowIso(), connectionId)
    .run();

  const affected = await env.DB.prepare(
    "SELECT calendar_id FROM google_calendar_access WHERE connection_id=?",
  )
    .bind(connectionId)
    .all<{ calendar_id: string }>();
  const forceCalendars = new Set<string>();
  for (const row of affected.results) {
    if (await recomputePreferredConnection(env, row.calendar_id)) {
      forceCalendars.add(row.calendar_id);
    }
  }

  const errors: unknown[] = [];
  for (const row of affected.results) {
    try {
      await syncCalendar(env, row.calendar_id, {
        forceFull: forceFull || forceCalendars.has(row.calendar_id),
      });
    } catch (error) {
      errors.push(error);
      console.error(
        `Google Calendar event sync failed for connection ${connectionId}, calendar ${row.calendar_id} (${describeGoogleCalendarError(error)}).`,
      );
    }
  }
  await env.DB.prepare(
    "UPDATE google_calendar_connections SET last_sync_at=?,updated_at=? WHERE id=?",
  )
    .bind(nowIso(), nowIso(), connectionId)
    .run();
  if (
    errors.some(
      (error) =>
        error instanceof GoogleCalendarApiError && error.isAuthenticationError,
    )
  ) {
    throw errors[0];
  }
}

export function syncConnection(
  env: Env,
  connectionId: string,
  options: { forceFull?: boolean } = {},
): Promise<void> {
  const current = connectionLocks.get(connectionId);
  if (current) return current;
  const promise = syncConnectionUnlocked(
    env,
    connectionId,
    options.forceFull ?? false,
  ).finally(() => connectionLocks.delete(connectionId));
  connectionLocks.set(connectionId, promise);
  return promise;
}

export async function syncAllConnections(
  env: Env,
  options: { staleAfterMs?: number; force?: boolean } = {},
): Promise<{ synchronized: number; errors: number }> {
  const rows = await env.DB.prepare(
    "SELECT id,last_sync_at FROM google_calendar_connections WHERE status IN ('connected','error')",
  ).all<{ id: string; last_sync_at: string | null }>();
  const cutoff = Date.now() - (options.staleAfterMs ?? 5 * 60_000);
  let synchronized = 0;
  let errors = 0;
  for (const row of rows.results) {
    if (
      !options.force &&
      row.last_sync_at &&
      Date.parse(row.last_sync_at) > cutoff
    ) {
      continue;
    }
    try {
      await syncConnection(env, row.id);
      synchronized += 1;
    } catch {
      errors += 1;
    }
  }
  const calendarErrors = await env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM google_calendar_access a
     JOIN google_calendar_connections c ON c.id=a.connection_id
     WHERE a.active=1 AND a.last_error IS NOT NULL
       AND c.status IN ('connected','error')`,
  ).first<{ count: number }>();
  errors += Number(calendarErrors?.count ?? 0);
  return { synchronized, errors };
}

export async function recomputeCalendarAfterAccessChange(
  env: Env,
  calendarId: string,
): Promise<void> {
  const changed = await recomputePreferredConnection(env, calendarId);
  if (changed) await syncCalendar(env, calendarId, { forceFull: true });
}
