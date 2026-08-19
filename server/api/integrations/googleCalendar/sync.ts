import { isAuthResponse, requireAuth } from "../../../_shared/auth";
import { methodNotAllowed, success, type Env } from "../../../_shared/http";
import { syncAllConnections } from "../../../googleCalendar/sync";

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "POST") return methodNotAllowed(["POST"]);
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  return success(await syncAllConnections(context.env, { force: true }));
}
