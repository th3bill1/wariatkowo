import { isAuthResponse, requireAuth } from "../../../_shared/auth";
import { methodNotAllowed, success, type Env } from "../../../_shared/http";
import { getConnectionStatus } from "../../../googleCalendar/data";

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  return success(await getConnectionStatus(context.env, auth.member.id));
}
