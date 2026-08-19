import { createApplicationSession } from "../../_shared/auth";
import { methodNotAllowed, type Env } from "../../_shared/http";
import {
  GoogleAccountNotAllowedError,
  GoogleIdentityConflictError,
  mapGoogleIdentityToMember,
} from "../../auth/googleIdentity";
import {
  clearOAuthStateCookie,
  oauthStatesMatch,
  readOAuthTransaction,
} from "../../auth/oauthState";

type LoginError =
  | "access_denied"
  | "invalid_state"
  | "missing_code"
  | "invalid_identity"
  | "not_allowed"
  | "oauth_failed"
  | "auth_failed";

function redirect(
  env: Env,
  location: string,
  sessionCookie?: string,
): Response {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
  });
  headers.append(
    "Set-Cookie",
    clearOAuthStateCookie(env.COOKIE_SECURE ?? true),
  );
  if (sessionCookie) headers.append("Set-Cookie", sessionCookie);
  return new Response(null, { status: 302, headers });
}

function loginError(env: Env, code: LoginError): Response {
  return redirect(env, `/logowanie?authError=${code}`);
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  const googleAuth = context.env.GOOGLE_AUTH;
  if (!googleAuth) throw new Error("Google authentication is not configured.");
  const url = new URL(context.request.url);
  const transaction = readOAuthTransaction(context.request);
  const receivedState = url.searchParams.get("state") ?? "";
  if (
    !transaction ||
    !receivedState ||
    !oauthStatesMatch(transaction.state, receivedState)
  ) {
    console.warn("Rejected Google OAuth callback with invalid state.");
    return loginError(context.env, "invalid_state");
  }

  const providerError = url.searchParams.get("error");
  if (providerError) {
    console.warn("Google OAuth authorization did not complete.");
    return loginError(
      context.env,
      providerError === "access_denied" ? "access_denied" : "oauth_failed",
    );
  }
  const authorizationCode = url.searchParams.get("code");
  if (!authorizationCode) return loginError(context.env, "missing_code");

  let identity;
  try {
    identity = await googleAuth.client.exchangeAndVerify(
      authorizationCode,
      transaction.codeVerifier,
    );
  } catch (error) {
    console.error(
      `Google authorization code or ID token validation failed (${safeErrorName(error)}).`,
    );
    return loginError(context.env, "oauth_failed");
  }
  if (!identity.emailVerified) {
    console.warn("Rejected Google identity without a verified email.");
    return loginError(context.env, "invalid_identity");
  }

  try {
    const member = await mapGoogleIdentityToMember(context.env, identity);
    const session = await createApplicationSession(context.env, member);
    return redirect(context.env, "/dashboard", session.cookie);
  } catch (error) {
    if (error instanceof GoogleAccountNotAllowedError) {
      console.warn("Rejected Google account that is not whitelisted.");
      return loginError(context.env, "not_allowed");
    }
    if (error instanceof GoogleIdentityConflictError) {
      console.error(`Google identity mapping conflict: ${error.message}`);
      return loginError(context.env, "auth_failed");
    }
    console.error(
      `Unable to create Wariatkowo session (${safeErrorName(error)}).`,
    );
    return loginError(context.env, "auth_failed");
  }
}
