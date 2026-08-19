import { randomBytes } from "node:crypto";
import {
  CodeChallengeMethod,
  OAuth2Client,
  type LoginTicket,
} from "google-auth-library";
import {
  validateGoogleIdTokenPayload,
  type GoogleIdentity,
} from "../auth/googleClient";
import type { GoogleCalendarConfig } from "./config";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export type GoogleCalendarAccessRole =
  | "owner"
  | "writer"
  | "writerWithoutPrivateAccess"
  | "reader"
  | "freeBusyReader";

export type GoogleCalendarEntry = {
  id: string;
  summary?: string;
  description?: string;
  timeZone?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
  primary?: boolean;
  selected?: boolean;
  hidden?: boolean;
  summaryOverride?: string;
  deleted?: boolean;
};

export type GoogleEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleEventPerson = {
  id?: string;
  email?: string;
  displayName?: string;
  self?: boolean;
  responseStatus?: string;
};

export type GoogleCalendarEventResource = {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventDate;
  end?: GoogleEventDate;
  organizer?: GoogleEventPerson;
  attendees?: GoogleEventPerson[];
  htmlLink?: string;
  hangoutLink?: string;
  eventType?: string;
  visibility?: string;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GoogleEventDate;
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  locked?: boolean;
  updated?: string;
};

export type GooglePage<T> = {
  items?: T[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

export type CalendarAuthorizationRequest = {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
};

export type CalendarAuthorizationResult = {
  identity: GoogleIdentity;
  refreshToken: string | null;
  grantedScopes: string[];
};

export interface GoogleCalendarClient {
  createAuthorizationRequest(
    loginHint: string,
  ): Promise<CalendarAuthorizationRequest>;
  exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<CalendarAuthorizationResult>;
  listCalendars(
    refreshToken: string,
    options: { pageToken?: string; syncToken?: string },
  ): Promise<GooglePage<GoogleCalendarEntry>>;
  listEvents(
    refreshToken: string,
    calendarId: string,
    options: { pageToken?: string; syncToken?: string },
  ): Promise<GooglePage<GoogleCalendarEventResource>>;
  getEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<GoogleCalendarEventResource>;
  insertEvent(
    refreshToken: string,
    calendarId: string,
    event: Partial<GoogleCalendarEventResource>,
  ): Promise<GoogleCalendarEventResource>;
  patchEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<GoogleCalendarEventResource>,
    etag?: string | null,
  ): Promise<GoogleCalendarEventResource>;
  deleteEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
    etag?: string | null,
  ): Promise<void>;
  revokeToken(refreshToken: string): Promise<void>;
}

export class GoogleCalendarApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(`Google Calendar API request failed (${status}, ${reason}).`);
    this.name = "GoogleCalendarApiError";
  }

  get isAuthenticationError(): boolean {
    return (
      this.status === 401 ||
      this.reason === "invalid_grant" ||
      this.reason === "invalidCredentials"
    );
  }
}

export function describeGoogleCalendarError(error: unknown): string {
  return error instanceof GoogleCalendarApiError
    ? `HTTP ${error.status}/${error.reason}`
    : error instanceof Error
      ? error.name
      : "UnknownError";
}

function apiError(error: unknown): GoogleCalendarApiError {
  if (error instanceof GoogleCalendarApiError) return error;
  const response = (error as { response?: { status?: number; data?: unknown } })
    ?.response;
  const data = response?.data as
    | {
        error?:
          string | { status?: string; errors?: Array<{ reason?: string }> };
      }
    | undefined;
  const reason =
    typeof data?.error === "string"
      ? data.error
      : (data?.error?.errors?.[0]?.reason ??
        data?.error?.status ??
        (error instanceof Error ? error.name : "unknown"));
  return new GoogleCalendarApiError(response?.status ?? 500, reason);
}

type OAuthPort = Pick<
  OAuth2Client,
  "generateAuthUrl" | "generateCodeVerifierAsync" | "getToken" | "verifyIdToken"
>;

export class GoogleCalendarHttpClient implements GoogleCalendarClient {
  private readonly authorizationClient: OAuthPort;

  constructor(
    private readonly config: GoogleCalendarConfig,
    authorizationClient?: OAuthPort,
  ) {
    this.authorizationClient =
      authorizationClient ??
      new OAuth2Client({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });
  }

  async createAuthorizationRequest(
    loginHint: string,
  ): Promise<CalendarAuthorizationRequest> {
    const { codeVerifier, codeChallenge } =
      await this.authorizationClient.generateCodeVerifierAsync();
    if (!codeChallenge)
      throw new Error("Google Calendar PKCE challenge was not created.");
    const state = randomBytes(32).toString("base64url");
    return {
      authorizationUrl: this.authorizationClient.generateAuthUrl({
        access_type: "offline",
        include_granted_scopes: true,
        prompt: "consent",
        login_hint: loginHint,
        scope: [...GOOGLE_CALENDAR_SCOPES],
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
      state,
      codeVerifier,
    };
  }

  async exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<CalendarAuthorizationResult> {
    const { tokens } = await this.authorizationClient.getToken({
      code,
      codeVerifier,
      redirect_uri: this.config.redirectUri,
    });
    if (!tokens.id_token) {
      throw new GoogleCalendarApiError(401, "missing_id_token");
    }
    const ticket: LoginTicket = await this.authorizationClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.clientId,
    });
    return {
      identity: validateGoogleIdTokenPayload(
        ticket.getPayload(),
        this.config.clientId,
      ),
      refreshToken: tokens.refresh_token ?? null,
      grantedScopes: (tokens.scope ?? "").split(/\s+/).filter(Boolean),
    };
  }

  private async request<T>(
    refreshToken: string,
    options: {
      url: string;
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      params?: Record<string, string | number | boolean | undefined>;
      data?: unknown;
      headers?: Record<string, string>;
    },
  ): Promise<T> {
    const client = new OAuth2Client({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
    });
    client.setCredentials({ refresh_token: refreshToken });
    try {
      const response = await client.request<T>(options);
      return response.data;
    } catch (error) {
      throw apiError(error);
    }
  }

  listCalendars(
    refreshToken: string,
    options: { pageToken?: string; syncToken?: string },
  ): Promise<GooglePage<GoogleCalendarEntry>> {
    return this.request(refreshToken, {
      url: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      params: {
        maxResults: 250,
        showDeleted: true,
        pageToken: options.pageToken,
        syncToken: options.syncToken,
      },
    });
  }

  listEvents(
    refreshToken: string,
    calendarId: string,
    options: { pageToken?: string; syncToken?: string },
  ): Promise<GooglePage<GoogleCalendarEventResource>> {
    return this.request(refreshToken, {
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      params: {
        maxResults: 2500,
        showDeleted: true,
        singleEvents: true,
        pageToken: options.pageToken,
        syncToken: options.syncToken,
      },
    });
  }

  getEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<GoogleCalendarEventResource> {
    return this.request(refreshToken, {
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    });
  }

  insertEvent(
    refreshToken: string,
    calendarId: string,
    event: Partial<GoogleCalendarEventResource>,
  ): Promise<GoogleCalendarEventResource> {
    return this.request(refreshToken, {
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      method: "POST",
      data: event,
    });
  }

  patchEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<GoogleCalendarEventResource>,
    etag?: string | null,
  ): Promise<GoogleCalendarEventResource> {
    return this.request(refreshToken, {
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      method: "PATCH",
      data: event,
      headers: etag ? { "If-Match": etag } : undefined,
    });
  }

  async deleteEvent(
    refreshToken: string,
    calendarId: string,
    eventId: string,
    etag?: string | null,
  ): Promise<void> {
    await this.request(refreshToken, {
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      method: "DELETE",
      headers: etag ? { "If-Match": etag } : undefined,
    });
  }

  async revokeToken(refreshToken: string): Promise<void> {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok && response.status !== 400) {
      throw new GoogleCalendarApiError(response.status, "revoke_failed");
    }
  }
}
