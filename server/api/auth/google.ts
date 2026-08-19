import { methodNotAllowed, type Env } from "../../_shared/http";
import { createOAuthStateCookie } from "../../auth/oauthState";

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

  try {
    const authorization = await googleAuth.client.createAuthorizationRequest();
    return new Response(null, {
      status: 302,
      headers: {
        Location: authorization.authorizationUrl,
        "Cache-Control": "no-store",
        "Set-Cookie": createOAuthStateCookie(
          authorization.state,
          authorization.codeVerifier,
          context.env.COOKIE_SECURE ?? true,
        ),
      },
    });
  } catch (error) {
    console.error(
      `Unable to start Google authentication (${safeErrorName(error)}).`,
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/logowanie?authError=oauth_failed",
        "Cache-Control": "no-store",
      },
    });
  }
}
