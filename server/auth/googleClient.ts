import { randomBytes } from "node:crypto";
import {
  CodeChallengeMethod,
  OAuth2Client,
  type LoginTicket,
  type TokenPayload,
} from "google-auth-library";
import type { GoogleAuthConfig } from "./googleConfig";

const GOOGLE_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com",
]);

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
};

export type GoogleAuthorizationRequest = {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
};

export interface GoogleIdentityClient {
  createAuthorizationRequest(): Promise<GoogleAuthorizationRequest>;
  exchangeAndVerify(
    authorizationCode: string,
    codeVerifier: string,
  ): Promise<GoogleIdentity>;
}

export type GoogleAuthDependencies = {
  config: GoogleAuthConfig;
  client: GoogleIdentityClient;
};

type OAuth2ClientPort = Pick<
  OAuth2Client,
  "generateAuthUrl" | "generateCodeVerifierAsync" | "getToken" | "verifyIdToken"
>;

export class GoogleIdentityValidationError extends Error {
  constructor() {
    super("Google ID token did not contain a valid verified identity.");
    this.name = "GoogleIdentityValidationError";
  }
}

export function validateGoogleIdTokenPayload(
  payload: TokenPayload | undefined,
  clientId: string,
  now = Date.now(),
): GoogleIdentity {
  const audience = payload?.aud;
  if (
    !payload ||
    !payload.iss ||
    !GOOGLE_ISSUERS.has(payload.iss) ||
    audience !== clientId ||
    typeof payload.exp !== "number" ||
    payload.exp * 1000 <= now ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    !payload.email.trim() ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim()
  ) {
    throw new GoogleIdentityValidationError();
  }
  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: true,
  };
}

export class GoogleOidcClient implements GoogleIdentityClient {
  private readonly oauthClient: OAuth2ClientPort;

  constructor(
    private readonly config: GoogleAuthConfig,
    oauthClient?: OAuth2ClientPort,
  ) {
    this.oauthClient =
      oauthClient ??
      new OAuth2Client({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      });
  }

  async createAuthorizationRequest(): Promise<GoogleAuthorizationRequest> {
    const { codeVerifier, codeChallenge } =
      await this.oauthClient.generateCodeVerifierAsync();
    if (!codeChallenge)
      throw new Error("Google PKCE challenge was not created.");
    const state = randomBytes(32).toString("base64url");
    return {
      authorizationUrl: this.oauthClient.generateAuthUrl({
        access_type: "online",
        scope: ["openid", "email", "profile"],
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
      }),
      state,
      codeVerifier,
    };
  }

  async exchangeAndVerify(
    authorizationCode: string,
    codeVerifier: string,
  ): Promise<GoogleIdentity> {
    const { tokens } = await this.oauthClient.getToken({
      code: authorizationCode,
      codeVerifier,
      redirect_uri: this.config.redirectUri,
    });
    if (!tokens.id_token) throw new GoogleIdentityValidationError();
    const ticket: LoginTicket = await this.oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.clientId,
    });
    return validateGoogleIdTokenPayload(
      ticket.getPayload(),
      this.config.clientId,
    );
  }
}
