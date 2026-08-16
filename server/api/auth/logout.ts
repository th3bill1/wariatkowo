import {
  clearSessionCookie,
  getAuthenticatedSession,
} from "../../_shared/auth";
import { methodNotAllowed, success, type Env } from "../../_shared/http";
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "POST") return methodNotAllowed(["POST"]);
  const session = await getAuthenticatedSession(context.request, context.env);
  if (session)
    await context.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(session.sessionId)
      .run();
  return success(
    { loggedOut: true },
    {
      headers: {
        "Set-Cookie": clearSessionCookie(context.env.COOKIE_SECURE ?? true),
      },
    },
  );
}
