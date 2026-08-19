import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TokenPayload } from "google-auth-library";
import { createSessionCookie, SESSION_COOKIE } from "../server/_shared/auth";
import type { Env } from "../server/_shared/http";
import { onRequest as googleCallback } from "../server/api/auth/googleCallback";
import { onRequest as googleLogin } from "../server/api/auth/google";
import { onRequest as authSession } from "../server/api/auth/session";
import { onRequest as tasksIndex } from "../server/api/tasks/index";
import {
  loadGoogleAuthConfig,
  parseGoogleAllowedUsers,
  type GoogleAuthConfig,
} from "../server/auth/googleConfig";
import {
  GoogleOidcClient,
  validateGoogleIdTokenPayload,
  type GoogleIdentity,
  type GoogleIdentityClient,
} from "../server/auth/googleClient";
import {
  GoogleAccountNotAllowedError,
  GoogleIdentityConflictError,
  mapGoogleIdentityToMember,
} from "../server/auth/googleIdentity";
import { createOAuthStateCookie } from "../server/auth/oauthState";
import { SqliteDatabase } from "../server/db/database";
import { applyMigrations } from "../server/db/migrations";

const MISIEK_EMAIL = "misiek@example.com";
const MISKA_EMAIL = "miska@example.com";
const STATE = "s".repeat(43);
const CODE_VERIFIER = "v".repeat(64);

function config(): GoogleAuthConfig {
  return {
    clientId: "test-client.apps.googleusercontent.com",
    clientSecret: "test-secret",
    redirectUri: "http://localhost:3000/api/auth/google/callback",
    allowedUsers: new Map([
      [MISIEK_EMAIL, "misiek"],
      [MISKA_EMAIL, "miska"],
    ]),
  };
}

function identity(
  email = MISIEK_EMAIL,
  sub = "google-sub-misiek",
  emailVerified = true,
): GoogleIdentity {
  return { email, sub, emailVerified };
}

function clientFor(result: GoogleIdentity = identity()): GoogleIdentityClient {
  return {
    createAuthorizationRequest: vi.fn(async () => ({
      authorizationUrl:
        "https://accounts.google.com/o/oauth2/v2/auth?scope=openid",
      state: STATE,
      codeVerifier: CODE_VERIFIER,
    })),
    exchangeAndVerify: vi.fn(async () => result),
  };
}

function createEnv(
  database: SqliteDatabase,
  client: GoogleIdentityClient = clientFor(),
): Env {
  return {
    DB: database,
    COOKIE_SECURE: false,
    GOOGLE_AUTH: { config: config(), client },
  };
}

function callbackRequest(query: string, includeCookie = true): Request {
  const headers = new Headers();
  if (includeCookie) {
    headers.set(
      "Cookie",
      createOAuthStateCookie(STATE, CODE_VERIFIER, false).split(";")[0],
    );
  }
  return new Request(
    `http://localhost:3000/api/auth/google/callback?${query}`,
    { headers },
  );
}

function sessionToken(response: Response): string {
  const cookies = response.headers.get("Set-Cookie") ?? "";
  const match = cookies.match(new RegExp(`${SESSION_COOKIE}=([^;,]+)`));
  if (!match) throw new Error("Session cookie missing from response.");
  return decodeURIComponent(match[1]);
}

describe("Google authentication", () => {
  let database: SqliteDatabase;

  beforeEach(() => {
    database = new SqliteDatabase(":memory:");
    applyMigrations(database.raw);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    database.close();
    vi.restoreAllMocks();
  });

  describe("whitelist configuration", () => {
    it("accepts the configured Misiek and Miśka accounts", () => {
      const whitelist = parseGoogleAllowedUsers(
        JSON.stringify({
          [MISIEK_EMAIL.toUpperCase()]: "misiek",
          [MISKA_EMAIL]: "miska",
        }),
      );
      expect(whitelist.get(MISIEK_EMAIL)).toBe("misiek");
      expect(whitelist.get(MISKA_EMAIL)).toBe("miska");
    });

    it("fails startup validation for malformed or incomplete configuration", () => {
      expect(() => parseGoogleAllowedUsers("not-json")).toThrow(
        "must be valid JSON",
      );
      expect(() =>
        parseGoogleAllowedUsers(JSON.stringify({ [MISIEK_EMAIL]: "someone" })),
      ).toThrow('must be "misiek" or "miska"');
      expect(() =>
        parseGoogleAllowedUsers(JSON.stringify({ [MISIEK_EMAIL]: "misiek" })),
      ).toThrow("must include one account mapped to miska");
      expect(() =>
        loadGoogleAuthConfig({
          GOOGLE_CLIENT_ID: "client",
          GOOGLE_CLIENT_SECRET: "secret",
          GOOGLE_REDIRECT_URI: "not-a-url",
          GOOGLE_ALLOWED_USERS_JSON: JSON.stringify({
            [MISIEK_EMAIL]: "misiek",
            [MISKA_EMAIL]: "miska",
          }),
        }),
      ).toThrow("must be an absolute URL");
      expect(() =>
        loadGoogleAuthConfig({
          GOOGLE_CLIENT_ID: "client",
          GOOGLE_CLIENT_SECRET: "secret",
          GOOGLE_REDIRECT_URI:
            "http://wariatkowo.example.com/api/auth/google/callback",
          GOOGLE_ALLOWED_USERS_JSON: JSON.stringify({
            [MISIEK_EMAIL]: "misiek",
            [MISKA_EMAIL]: "miska",
          }),
        }),
      ).toThrow("must use HTTPS");
    });
  });

  describe("ID token verification", () => {
    const validPayload = (): TokenPayload =>
      ({
        iss: "https://accounts.google.com",
        aud: "test-client.apps.googleusercontent.com",
        exp: Math.floor(Date.now() / 1000) + 300,
        sub: "google-sub-misiek",
        email: MISIEK_EMAIL,
        email_verified: true,
      }) as TokenPayload;

    it("accepts only current, correctly issued and addressed verified identities", () => {
      expect(
        validateGoogleIdTokenPayload(
          validPayload(),
          "test-client.apps.googleusercontent.com",
        ),
      ).toEqual(identity());

      for (const invalid of [
        { ...validPayload(), email_verified: false },
        { ...validPayload(), exp: 1 },
        { ...validPayload(), aud: "another-client" },
        { ...validPayload(), iss: "https://example.com" },
      ]) {
        expect(() =>
          validateGoogleIdTokenPayload(
            invalid as TokenPayload,
            "test-client.apps.googleusercontent.com",
          ),
        ).toThrow("valid verified identity");
      }
    });

    it("exchanges the code server-side and verifies the returned ID token", async () => {
      const payload = validPayload();
      const oauthClient = {
        generateAuthUrl: vi.fn(() => "https://accounts.google.com/auth"),
        generateCodeVerifierAsync: vi.fn(async () => ({
          codeVerifier: CODE_VERIFIER,
          codeChallenge: "challenge",
        })),
        getToken: vi.fn(async () => ({
          tokens: { id_token: "signed-id-token" },
          res: null,
        })),
        verifyIdToken: vi.fn(async () => ({ getPayload: () => payload })),
      };
      const client = new GoogleOidcClient(config(), oauthClient as never);
      await expect(
        client.exchangeAndVerify("authorization-code", CODE_VERIFIER),
      ).resolves.toEqual(identity());
      expect(oauthClient.getToken).toHaveBeenCalledWith({
        code: "authorization-code",
        codeVerifier: CODE_VERIFIER,
        redirect_uri: config().redirectUri,
      });
      expect(oauthClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: "signed-id-token",
        audience: config().clientId,
      });
    });

    it("requests only authentication scopes and binds the flow with PKCE", async () => {
      const oauthClient = {
        generateAuthUrl: vi.fn(() => "https://accounts.google.com/auth"),
        generateCodeVerifierAsync: vi.fn(async () => ({
          codeVerifier: CODE_VERIFIER,
          codeChallenge: "challenge",
        })),
        getToken: vi.fn(),
        verifyIdToken: vi.fn(),
      };
      const request = await new GoogleOidcClient(
        config(),
        oauthClient as never,
      ).createAuthorizationRequest();
      expect(request.codeVerifier).toBe(CODE_VERIFIER);
      expect(oauthClient.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: "online",
          scope: ["openid", "email", "profile"],
          code_challenge: "challenge",
          code_challenge_method: "S256",
        }),
      );
      expect(
        JSON.stringify(oauthClient.generateAuthUrl.mock.calls),
      ).not.toContain("calendar");
    });
  });

  describe("identity mapping", () => {
    it("maps both whitelisted accounts to their existing members", async () => {
      const env = createEnv(database);
      await expect(
        mapGoogleIdentityToMember(env, identity()),
      ).resolves.toMatchObject({ id: "member-misiek", slug: "misiek" });
      await expect(
        mapGoogleIdentityToMember(
          env,
          identity(MISKA_EMAIL, "google-sub-miska"),
        ),
      ).resolves.toMatchObject({ id: "member-miska", slug: "miska" });
    });

    it("stores google_sub and resolves repeated login to the same member", async () => {
      const env = createEnv(database);
      const first = await mapGoogleIdentityToMember(env, identity());
      const repeated = await mapGoogleIdentityToMember(env, identity());
      expect(repeated).toEqual(first);
      expect(
        database.raw
          .prepare(
            "SELECT google_email, google_sub FROM household_members WHERE id = ?",
          )
          .get("member-misiek"),
      ).toEqual({
        google_email: MISIEK_EMAIL,
        google_sub: "google-sub-misiek",
      });
    });

    it("rejects an unknown account", async () => {
      await expect(
        mapGoogleIdentityToMember(
          createEnv(database),
          identity("unknown@example.com", "unknown-sub"),
        ),
      ).rejects.toBeInstanceOf(GoogleAccountNotAllowedError);
    });

    it("cannot associate one Google subject with both members", async () => {
      const env = createEnv(database);
      await mapGoogleIdentityToMember(env, identity());
      await expect(
        mapGoogleIdentityToMember(
          env,
          identity(MISKA_EMAIL, "google-sub-misiek"),
        ),
      ).rejects.toBeInstanceOf(GoogleIdentityConflictError);
    });
  });

  describe("OAuth endpoints", () => {
    it("starts the authorization flow with a short-lived HTTP-only state cookie", async () => {
      const env = createEnv(database);
      const response = await googleLogin({
        request: new Request("http://localhost:3000/api/auth/google"),
        env,
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toContain("accounts.google.com");
      const cookie = response.headers.get("Set-Cookie") ?? "";
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Max-Age=600");
    });

    it("creates the normal local session after a valid callback", async () => {
      const env = createEnv(database);
      const response = await googleCallback({
        request: callbackRequest(`state=${STATE}&code=valid-code`),
        env,
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/dashboard");

      const token = sessionToken(response);
      const sessionResponse = await authSession({
        request: new Request("http://localhost:3000/api/auth/session", {
          headers: { Cookie: `${SESSION_COOKIE}=${token}` },
        }),
        env,
      });
      expect(await sessionResponse.json()).toEqual({
        data: { id: "member-misiek", name: "Misiek", slug: "misiek" },
      });
      const protectedResponse = await tasksIndex({
        request: new Request("http://localhost:3000/api/tasks", {
          headers: { Cookie: `${SESSION_COOKIE}=${token}` },
        }),
        env,
      });
      expect(protectedResponse.status).toBe(200);
    });

    it("rejects an invalid state before exchanging a code", async () => {
      const client = clientFor();
      const response = await googleCallback({
        request: callbackRequest("state=wrong-state&code=code"),
        env: createEnv(database, client),
      });
      expect(response.headers.get("Location")).toBe(
        "/logowanie?authError=invalid_state",
      );
      expect(client.exchangeAndVerify).not.toHaveBeenCalled();
    });

    it("handles a missing authorization code", async () => {
      const response = await googleCallback({
        request: callbackRequest(`state=${STATE}`),
        env: createEnv(database),
      });
      expect(response.headers.get("Location")).toBe(
        "/logowanie?authError=missing_code",
      );
    });

    it("handles token exchange or ID token validation failure", async () => {
      const client = clientFor();
      vi.mocked(client.exchangeAndVerify).mockRejectedValueOnce(
        new Error("invalid token"),
      );
      const response = await googleCallback({
        request: callbackRequest(`state=${STATE}&code=bad-code`),
        env: createEnv(database, client),
      });
      expect(response.headers.get("Location")).toBe(
        "/logowanie?authError=oauth_failed",
      );
    });

    it("rejects an unverified email", async () => {
      const response = await googleCallback({
        request: callbackRequest(`state=${STATE}&code=code`),
        env: createEnv(
          database,
          clientFor(identity(MISIEK_EMAIL, "sub", false)),
        ),
      });
      expect(response.headers.get("Location")).toBe(
        "/logowanie?authError=invalid_identity",
      );
    });

    it("rejects a non-whitelisted account without exposing the whitelist", async () => {
      const response = await googleCallback({
        request: callbackRequest(`state=${STATE}&code=code`),
        env: createEnv(
          database,
          clientFor(identity("unknown@example.com", "unknown-sub")),
        ),
      });
      expect(response.headers.get("Location")).toBe(
        "/logowanie?authError=not_allowed",
      );
      expect(response.headers.get("Location")).not.toContain(MISIEK_EMAIL);
    });

    it("handles a Google OAuth cancellation", async () => {
      const client = clientFor();
      const response = await googleCallback({
        request: callbackRequest(`state=${STATE}&error=access_denied`),
        env: createEnv(database, client),
      });
      expect(response.headers.get("Location")).toBe(
        "/logowanie?authError=access_denied",
      );
      expect(client.exchangeAndVerify).not.toHaveBeenCalled();
    });
  });

  it("creates a hardened same-origin application cookie", () => {
    const cookie = createSessionCookie(
      "secret",
      new Date("2030-01-01T00:00:00Z"),
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
});
