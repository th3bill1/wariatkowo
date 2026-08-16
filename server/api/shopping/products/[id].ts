import { isAuthResponse, requireAuth } from "../../../_shared/auth";
import {
  error,
  methodNotAllowed,
  success,
  type Env,
} from "../../../_shared/http";

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: { id?: string };
}): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  if (context.request.method !== "DELETE") return methodNotAllowed(["DELETE"]);
  const id = context.params.id;
  if (!id) return error("VALIDATION_ERROR", "Brak identyfikatora produktu.");
  const existing = await context.env.DB.prepare(
    "SELECT id FROM shopping_products WHERE id=?",
  )
    .bind(id)
    .first();
  if (!existing)
    return error("NOT_FOUND", "Produktu nie ma już w historii.", 404);
  await context.env.DB.prepare("DELETE FROM shopping_products WHERE id=?")
    .bind(id)
    .run();
  return success({ deleted: true });
}
