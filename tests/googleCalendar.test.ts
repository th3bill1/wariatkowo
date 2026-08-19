import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, sha256 } from "../server/_shared/auth";
import type { Env } from "../server/_shared/http";
import { onRequest as calendarItem } from "../server/api/calendar/[id]";
import { onRequest as calendarIndex } from "../server/api/calendar/index";
import { onRequest as calendarCallback } from "../server/api/integrations/googleCalendar/callback";
import { onRequest as calendarConnect } from "../server/api/integrations/googleCalendar/connect";
import {
  GOOGLE_CALENDAR_SCOPES,
  GoogleCalendarApiError,
  GoogleCalendarHttpClient,
  type GoogleCalendarClient,
  type GoogleCalendarEventResource,
} from "../server/googleCalendar/client";
import {
  createGoogleEvent,
  listCalendarSources,
  listGoogleEvents,
} from "../server/googleCalendar/data";
import {
  calendarRoleCanCreate,
  eventCanMutate,
  syncCalendar,
  syncConnection,
} from "../server/googleCalendar/sync";
import { AesGcmTokenCipher } from "../server/googleCalendar/tokenCipher";
import { SqliteDatabase } from "../server/db/database";
import { applyMigrations } from "../server/db/migrations";

const STATE = "c".repeat(43);
const VERIFIER = "v".repeat(64);
const MISIEK_EMAIL = "misiek@example.com";
const TOKEN_KEY = Buffer.alloc(32, 17).toString("base64url");

function event(
  id: string,
  summary = id,
  overrides: Partial<GoogleCalendarEventResource> = {},
): GoogleCalendarEventResource {
  return {
    id,
    etag: `etag-${id}`,
    status: "confirmed",
    summary,
    start: { dateTime: "2026-08-20T10:00:00+02:00" },
    end: { dateTime: "2026-08-20T11:00:00+02:00" },
    updated: "2026-08-19T08:00:00Z",
    ...overrides,
  };
}

function mockClient(): GoogleCalendarClient {
  return {
    createAuthorizationRequest: vi.fn(async () => ({
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      state: STATE,
      codeVerifier: VERIFIER,
    })),
    exchangeAuthorizationCode: vi.fn(async () => ({
      identity: {
        sub: "sub-misiek",
        email: MISIEK_EMAIL,
        emailVerified: true,
      },
      refreshToken: "refresh-token",
      grantedScopes: [...GOOGLE_CALENDAR_SCOPES],
    })),
    listCalendars: vi.fn(async () => ({
      items: [
        {
          id: "primary@example.com",
          summary: "Prywatny",
          accessRole: "owner",
          primary: true,
          selected: true,
          backgroundColor: "#7c5caf",
        },
      ],
      nextSyncToken: "calendar-list-sync-1",
    })),
    listEvents: vi.fn(async () => ({
      items: [event("event-1", "Dentysta")],
      nextSyncToken: "event-sync-1",
    })),
    getEvent: vi.fn(async () => event("event-1", "Dentysta")),
    insertEvent: vi.fn(async (_token, _calendar, resource) =>
      event("created-event", resource.summary ?? "Nowe", {
        ...resource,
        id: "created-event",
      }),
    ),
    patchEvent: vi.fn(async (_token, _calendar, id, resource) =>
      event(id, resource.summary ?? "Dentysta", {
        ...resource,
        id,
        etag: "etag-updated",
      }),
    ),
    deleteEvent: vi.fn(async () => undefined),
    revokeToken: vi.fn(async () => undefined),
  };
}

function createEnv(database: SqliteDatabase, client = mockClient()): Env {
  return {
    DB: database,
    COOKIE_SECURE: false,
    GOOGLE_CALENDAR: {
      config: {
        clientId: "client.apps.googleusercontent.com",
        clientSecret: "secret",
        redirectUri:
          "http://localhost:3000/api/integrations/google-calendar/callback",
      },
      client,
      tokenCipher: new AesGcmTokenCipher(TOKEN_KEY),
    },
  };
}

async function authenticate(
  database: SqliteDatabase,
  memberId = "member-misiek",
): Promise<string> {
  const token = `session-${memberId}`;
  const timestamp = new Date().toISOString();
  await database
    .prepare(
      "INSERT INTO sessions (id,token_hash,member_id,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)",
    )
    .bind(
      `session-id-${memberId}`,
      await sha256(token),
      memberId,
      "2030-01-01T00:00:00.000Z",
      timestamp,
      timestamp,
    )
    .run();
  return `${SESSION_COOKIE}=${token}`;
}

async function setMemberIdentity(
  database: SqliteDatabase,
  memberId = "member-misiek",
  sub = "sub-misiek",
  email = MISIEK_EMAIL,
): Promise<void> {
  await database
    .prepare(
      "UPDATE household_members SET google_sub=?,google_email=? WHERE id=?",
    )
    .bind(sub, email, memberId)
    .run();
}

async function insertConnection(
  database: SqliteDatabase,
  env: Env,
  options: {
    id?: string;
    memberId?: string;
    sub?: string;
    email?: string;
    refreshToken?: string;
  } = {},
): Promise<string> {
  const id = options.id ?? "connection-misiek";
  const memberId = options.memberId ?? "member-misiek";
  const sub = options.sub ?? "sub-misiek";
  const email = options.email ?? MISIEK_EMAIL;
  const timestamp = new Date().toISOString();
  await setMemberIdentity(database, memberId, sub, email);
  await database
    .prepare(
      `INSERT INTO google_calendar_connections
       (id,member_id,google_sub,google_email,encrypted_refresh_token,granted_scopes,connected_at,updated_at,status)
       VALUES (?,?,?,?,?,?,?,?, 'connected')`,
    )
    .bind(
      id,
      memberId,
      sub,
      email,
      env.GOOGLE_CALENDAR!.tokenCipher.encrypt(
        options.refreshToken ?? `refresh-${memberId}`,
      ),
      GOOGLE_CALENDAR_SCOPES.join(" "),
      timestamp,
      timestamp,
    )
    .run();
  return id;
}

describe("Google Calendar integration", () => {
  let database: SqliteDatabase;

  beforeEach(() => {
    database = new SqliteDatabase(":memory:");
    applyMigrations(database.raw);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    database.close();
    vi.restoreAllMocks();
  });

  describe("authorization and encrypted connection storage", () => {
    it("requests only the two narrow Calendar scopes with offline consent", async () => {
      const oauth = {
        generateAuthUrl: vi.fn(() => "https://accounts.google.com/auth"),
        generateCodeVerifierAsync: vi.fn(async () => ({
          codeVerifier: VERIFIER,
          codeChallenge: "challenge",
        })),
        getToken: vi.fn(),
        verifyIdToken: vi.fn(),
      };
      const client = new GoogleCalendarHttpClient(
        {
          clientId: "client",
          clientSecret: "secret",
          redirectUri:
            "http://localhost:3000/api/integrations/google-calendar/callback",
        },
        oauth as never,
      );
      await client.createAuthorizationRequest(MISIEK_EMAIL);
      expect(oauth.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: "offline",
          include_granted_scopes: true,
          prompt: "consent",
          login_hint: MISIEK_EMAIL,
          scope: [...GOOGLE_CALENDAR_SCOPES],
        }),
      );
      expect(JSON.stringify(oauth.generateAuthUrl.mock.calls)).not.toContain(
        '"https://www.googleapis.com/auth/calendar"',
      );
    });

    it("validates AES-GCM keys and never stores the refresh token as plaintext", () => {
      expect(() => new AesGcmTokenCipher("short")).toThrow("exactly 32 bytes");
      const cipher = new AesGcmTokenCipher(TOKEN_KEY);
      const encrypted = cipher.encrypt("refresh-secret");
      expect(encrypted).not.toContain("refresh-secret");
      expect(cipher.decrypt(encrypted)).toBe("refresh-secret");
      expect(cipher.encrypt("refresh-secret")).not.toBe(encrypted);
    });

    it("binds one-time OAuth state to the authenticated member and stores an encrypted token", async () => {
      const client = mockClient();
      const env = createEnv(database, client);
      await setMemberIdentity(database);
      const cookie = await authenticate(database);
      const connectResponse = await calendarConnect({
        request: new Request(
          "http://localhost:3000/api/integrations/google-calendar/connect",
          { headers: { Cookie: cookie } },
        ),
        env,
      });
      const stateCookie = (
        connectResponse.headers.get("Set-Cookie") ?? ""
      ).split(";")[0];
      expect(connectResponse.status).toBe(302);
      expect(client.createAuthorizationRequest).toHaveBeenCalledWith(
        MISIEK_EMAIL,
      );

      const callbackRequest = () =>
        new Request(
          `http://localhost:3000/api/integrations/google-calendar/callback?state=${STATE}&code=code`,
          { headers: { Cookie: `${cookie}; ${stateCookie}` } },
        );
      const callbackResponse = await calendarCallback({
        request: callbackRequest(),
        env,
      });
      expect(callbackResponse.headers.get("Location")).toBe(
        "/kalendarz?googleCalendar=connected",
      );
      const row = database.raw
        .prepare(
          "SELECT encrypted_refresh_token FROM google_calendar_connections WHERE member_id=?",
        )
        .get("member-misiek") as { encrypted_refresh_token: string };
      expect(row.encrypted_refresh_token).not.toContain("refresh-token");
      expect(
        env.GOOGLE_CALENDAR!.tokenCipher.decrypt(row.encrypted_refresh_token),
      ).toBe("refresh-token");

      const replay = await calendarCallback({
        request: callbackRequest(),
        env,
      });
      expect(replay.headers.get("Location")).toBe(
        "/kalendarz?googleCalendar=invalid_state",
      );
      expect(client.exchangeAuthorizationCode).toHaveBeenCalledTimes(1);

      vi.mocked(client.exchangeAuthorizationCode).mockResolvedValueOnce({
        identity: {
          sub: "sub-misiek",
          email: MISIEK_EMAIL,
          emailVerified: true,
        },
        refreshToken: "replacement-refresh-token",
        grantedScopes: [...GOOGLE_CALENDAR_SCOPES],
      });
      const reconnectStart = await calendarConnect({
        request: new Request(
          "http://localhost:3000/api/integrations/google-calendar/connect",
          { headers: { Cookie: cookie } },
        ),
        env,
      });
      const reconnectCookie = (
        reconnectStart.headers.get("Set-Cookie") ?? ""
      ).split(";")[0];
      const reconnect = await calendarCallback({
        request: new Request(
          `http://localhost:3000/api/integrations/google-calendar/callback?state=${STATE}&code=reconnect-code`,
          { headers: { Cookie: `${cookie}; ${reconnectCookie}` } },
        ),
        env,
      });
      expect(reconnect.headers.get("Location")).toBe(
        "/kalendarz?googleCalendar=connected",
      );
      const connections = database.raw
        .prepare(
          "SELECT encrypted_refresh_token FROM google_calendar_connections WHERE member_id=?",
        )
        .all("member-misiek") as Array<{ encrypted_refresh_token: string }>;
      expect(connections).toHaveLength(1);
      expect(
        env.GOOGLE_CALENDAR!.tokenCipher.decrypt(
          connections[0].encrypted_refresh_token,
        ),
      ).toBe("replacement-refresh-token");
    });

    it("rejects a different Google account and a missing offline refresh token", async () => {
      const client = mockClient();
      const env = createEnv(database, client);
      await setMemberIdentity(database);
      const cookie = await authenticate(database);

      const run = async () => {
        const start = await calendarConnect({
          request: new Request(
            "http://localhost/api/integrations/google-calendar/connect",
            {
              headers: { Cookie: cookie },
            },
          ),
          env,
        });
        const oauthCookie = (start.headers.get("Set-Cookie") ?? "").split(
          ";",
        )[0];
        return calendarCallback({
          request: new Request(
            `http://localhost/api/integrations/google-calendar/callback?state=${STATE}&code=code`,
            { headers: { Cookie: `${cookie}; ${oauthCookie}` } },
          ),
          env,
        });
      };

      vi.mocked(client.exchangeAuthorizationCode).mockResolvedValueOnce({
        identity: {
          sub: "sub-miska",
          email: "miska@example.com",
          emailVerified: true,
        },
        refreshToken: "wrong-token",
        grantedScopes: [...GOOGLE_CALENDAR_SCOPES],
      });
      expect((await run()).headers.get("Location")).toBe(
        "/kalendarz?googleCalendar=wrong_account",
      );
      expect(
        database.raw
          .prepare("SELECT COUNT(*) AS count FROM google_calendar_connections")
          .get(),
      ).toEqual({ count: 0 });

      vi.mocked(client.exchangeAuthorizationCode).mockResolvedValueOnce({
        identity: {
          sub: "sub-misiek",
          email: MISIEK_EMAIL,
          emailVerified: true,
        },
        refreshToken: null,
        grantedScopes: [...GOOGLE_CALENDAR_SCOPES],
      });
      expect((await run()).headers.get("Location")).toBe(
        "/kalendarz?googleCalendar=offline_access_missing",
      );
    });
  });

  describe("discovery, deduplication and synchronization", () => {
    it("imports paginated calendars/events and preserves access roles", async () => {
      const client = mockClient();
      vi.mocked(client.listCalendars).mockImplementation(
        async (_token, options) =>
          options.pageToken
            ? {
                items: [
                  {
                    id: "readonly@example.com",
                    summary: "Święta",
                    accessRole: "reader",
                    selected: true,
                  },
                ],
                nextSyncToken: "list-sync",
              }
            : {
                items: [
                  {
                    id: "primary@example.com",
                    summary: "Prywatny",
                    accessRole: "owner",
                    primary: true,
                  },
                ],
                nextPageToken: "page-2",
              },
      );
      vi.mocked(client.listEvents).mockImplementation(
        async (_token, calendarId, options) =>
          calendarId === "primary@example.com" && !options.pageToken
            ? { items: [event("one")], nextPageToken: "event-page-2" }
            : calendarId === "primary@example.com"
              ? { items: [event("two")], nextSyncToken: "events-sync" }
              : { items: [], nextSyncToken: "readonly-sync" },
      );
      const env = createEnv(database, client);
      const connectionId = await insertConnection(database, env);
      await syncConnection(env, connectionId, { forceFull: true });

      expect(
        database.raw
          .prepare("SELECT COUNT(*) AS count FROM google_calendars")
          .get(),
      ).toEqual({ count: 2 });
      expect(
        database.raw
          .prepare(
            "SELECT access_role FROM google_calendar_access WHERE calendar_id='readonly@example.com'",
          )
          .get(),
      ).toEqual({ access_role: "reader" });
      expect(
        (await listGoogleEvents(env, "2026-08-01", "2026-08-31")).map(
          (item) => item.title,
        ),
      ).toEqual(["one", "two"]);
    });

    it("deduplicates a shared calendar and keeps the highest-access connection preferred", async () => {
      const client = mockClient();
      vi.mocked(client.listCalendars).mockImplementation(async (token) => ({
        items: [
          {
            id: "family@example.com",
            summary: "Rodzina",
            accessRole: token.includes("misiek") ? "owner" : "reader",
          },
        ],
        nextSyncToken: `list-${token}`,
      }));
      vi.mocked(client.listEvents).mockResolvedValue({
        items: [event("family-event")],
        nextSyncToken: "event-sync",
      });
      const env = createEnv(database, client);
      const misiek = await insertConnection(database, env, {
        refreshToken: "refresh-misiek",
      });
      const miska = await insertConnection(database, env, {
        id: "connection-miska",
        memberId: "member-miska",
        sub: "sub-miska",
        email: "miska@example.com",
        refreshToken: "refresh-miska",
      });
      await syncConnection(env, misiek, { forceFull: true });
      await syncConnection(env, miska, { forceFull: true });

      expect(
        database.raw
          .prepare("SELECT COUNT(*) AS count FROM google_calendars")
          .get(),
      ).toEqual({ count: 1 });
      expect(
        database.raw
          .prepare(
            "SELECT preferred_connection_id FROM google_calendars WHERE calendar_id='family@example.com'",
          )
          .get(),
      ).toEqual({ preferred_connection_id: misiek });
      const sources = await listCalendarSources(env);
      expect(sources.filter((source) => source.kind === "google")).toHaveLength(
        1,
      );
      expect(
        sources.find((source) => source.kind === "google")?.ownerNames,
      ).toHaveLength(2);
    });

    it("applies incremental changes and removes only the cancelled event instance", async () => {
      const client = mockClient();
      vi.mocked(client.listEvents).mockResolvedValueOnce({
        items: [
          event("event-1", "Do usunięcia"),
          event("event-stay", "Stary tytuł"),
        ],
        nextSyncToken: "event-sync-1",
      });
      const env = createEnv(database, client);
      const connectionId = await insertConnection(database, env);
      await syncConnection(env, connectionId, { forceFull: true });
      vi.mocked(client.listCalendars).mockResolvedValueOnce({
        items: [],
        nextSyncToken: "calendar-list-sync-2",
      });
      vi.mocked(client.listEvents).mockResolvedValueOnce({
        items: [
          { id: "event-1", status: "cancelled" },
          event("event-stay", "Zmieniony tytuł", { etag: "etag-new" }),
          event("event-2", "Nowe wydarzenie", {
            recurringEventId: "series-1",
            originalStartTime: { dateTime: "2026-08-20T10:00:00+02:00" },
          }),
        ],
        nextSyncToken: "event-sync-2",
      });
      await syncConnection(env, connectionId);
      const events = await listGoogleEvents(env, "2026-08-01", "2026-08-31");
      expect(events.map((item) => item.title)).toEqual(
        expect.arrayContaining(["Zmieniony tytuł", "Nowe wydarzenie"]),
      );
      const recurring = events.find((item) => item.title === "Nowe wydarzenie");
      expect(recurring?.recurring).toBe(true);
      expect(recurring?.canDelete).toBe(false);
      expect(client.listEvents).toHaveBeenLastCalledWith(
        expect.any(String),
        "primary@example.com",
        expect.objectContaining({ syncToken: "event-sync-1" }),
      );
    });

    it("falls back to a full sync after 410 and coalesces simultaneous syncs", async () => {
      const client = mockClient();
      const env = createEnv(database, client);
      const connectionId = await insertConnection(database, env);
      await syncConnection(env, connectionId, { forceFull: true });

      vi.mocked(client.listEvents)
        .mockRejectedValueOnce(
          new GoogleCalendarApiError(410, "fullSyncRequired"),
        )
        .mockResolvedValueOnce({
          items: [event("fresh", "Świeże")],
          nextSyncToken: "fresh-sync",
        });
      await syncCalendar(env, "primary@example.com");
      expect(
        vi.mocked(client.listEvents).mock.calls.at(-1)?.[2].syncToken,
      ).toBeUndefined();

      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.mocked(client.listCalendars).mockImplementationOnce(async () => {
        await gate;
        return { items: [], nextSyncToken: "coalesced" };
      });
      const first = syncConnection(env, connectionId);
      const second = syncConnection(env, connectionId);
      expect(second).toBe(first);
      release();
      await Promise.all([first, second]);
    });
  });

  describe("permissions and two-way CRUD", () => {
    it("enforces calendar and event-level mutation restrictions", () => {
      expect(calendarRoleCanCreate("owner")).toBe(true);
      expect(calendarRoleCanCreate("writer")).toBe(true);
      expect(calendarRoleCanCreate("reader")).toBe(false);
      expect(calendarRoleCanCreate("freeBusyReader")).toBe(false);
      expect(
        eventCanMutate("writerWithoutPrivateAccess", {
          locked: false,
          visibility: "private",
          eventType: "default",
        }),
      ).toBe(false);
      expect(
        eventCanMutate("owner", {
          locked: true,
          visibility: "default",
          eventType: "default",
        }),
      ).toBe(false);
    });

    it("creates, patches and deletes the actual Google event", async () => {
      const client = mockClient();
      const env = createEnv(database, client);
      const connectionId = await insertConnection(database, env);
      await syncConnection(env, connectionId, { forceFull: true });
      const created = await createGoogleEvent(
        env,
        { id: "member-misiek", name: "Misiek", slug: "misiek" },
        "google:primary@example.com",
        {
          title: "Weterynarz",
          type: "appointment",
          startDate: "2026-08-29T13:00:00.000Z",
          allDay: false,
        },
      );
      expect(client.insertEvent).toHaveBeenCalledOnce();
      expect(created.source).toBe("google");

      const cookie = await authenticate(database);
      const updateResponse = await calendarItem({
        request: new Request(`http://localhost/api/calendar/${created.id}`, {
          method: "PATCH",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title: "Weterynarz — kontrola" }),
        }),
        env,
        params: { id: created.id },
      });
      expect(updateResponse.status).toBe(200);
      expect(client.patchEvent).toHaveBeenCalledOnce();

      const deleteResponse = await calendarItem({
        request: new Request(`http://localhost/api/calendar/${created.id}`, {
          method: "DELETE",
          headers: { Cookie: cookie },
        }),
        env,
        params: { id: created.id },
      });
      expect(deleteResponse.status).toBe(204);
      expect(client.deleteEvent).toHaveBeenCalledOnce();
    });

    it("does not call Google for local deletion and does not fake success on a Google error", async () => {
      const client = mockClient();
      const env = createEnv(database, client);
      const connectionId = await insertConnection(database, env);
      await syncConnection(env, connectionId, { forceFull: true });
      const cookie = await authenticate(database);
      const timestamp = new Date().toISOString();
      database.raw
        .prepare(
          "INSERT INTO calendar_events (id,title,type,start_date,all_day,created_by_member_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .run(
          "local-event",
          "Lokalne",
          "event",
          "2026-08-20",
          1,
          "member-misiek",
          timestamp,
          timestamp,
        );
      const localResponse = await calendarItem({
        request: new Request("http://localhost/api/calendar/local-event", {
          method: "DELETE",
          headers: { Cookie: cookie },
        }),
        env,
        params: { id: "local-event" },
      });
      expect(localResponse.status).toBe(204);
      expect(client.deleteEvent).not.toHaveBeenCalled();

      const google = (
        await listGoogleEvents(env, "2026-08-01", "2026-08-31")
      )[0];
      vi.mocked(client.deleteEvent).mockRejectedValueOnce(
        new GoogleCalendarApiError(500, "backendError"),
      );
      const failed = await calendarItem({
        request: new Request(`http://localhost/api/calendar/${google.id}`, {
          method: "DELETE",
          headers: { Cookie: cookie },
        }),
        env,
        params: { id: google.id },
      });
      expect(failed.status).toBe(502);
      expect(
        await listGoogleEvents(env, "2026-08-01", "2026-08-31"),
      ).toHaveLength(1);
    });

    it("rejects creation in a read-only Google calendar", async () => {
      const client = mockClient();
      vi.mocked(client.listCalendars).mockResolvedValue({
        items: [
          {
            id: "readonly@example.com",
            summary: "Święta",
            accessRole: "reader",
          },
        ],
        nextSyncToken: "list",
      });
      vi.mocked(client.listEvents).mockResolvedValue({
        items: [],
        nextSyncToken: "events",
      });
      const env = createEnv(database, client);
      await syncConnection(env, await insertConnection(database, env), {
        forceFull: true,
      });
      const cookie = await authenticate(database);
      const response = await calendarIndex({
        request: new Request("http://localhost/api/calendar", {
          method: "POST",
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Nie wolno",
            startDate: "2026-08-20",
            allDay: true,
            calendarSourceId: "google:readonly@example.com",
          }),
        }),
        env,
      });
      expect(response.status).toBe(403);
      expect(client.insertEvent).not.toHaveBeenCalled();
    });
  });
});
