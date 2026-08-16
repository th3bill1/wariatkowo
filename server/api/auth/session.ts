import { getAuthenticatedSession } from "../../_shared/auth";
import { methodNotAllowed, success, type Env } from "../../_shared/http";
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  const session = await getAuthenticatedSession(context.request, context.env);
  return success(session?.member ?? null);
}
