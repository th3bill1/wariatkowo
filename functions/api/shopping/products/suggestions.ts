import { isAuthResponse, requireAuth } from "../../../_shared/auth";
import { methodNotAllowed, success, type Env } from "../../../_shared/http";
import { normalizeProductName } from "../../../../shared/shopping";
import {
  SHOPPING_PRODUCT_COLUMNS,
  toShoppingProduct,
  type ShoppingProductRow,
} from "../../../_shared/shoppingProducts";

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  if (context.request.method !== "GET") return methodNotAllowed(["GET"]);
  const url = new URL(context.request.url);
  const query = normalizeProductName(url.searchParams.get("q") ?? "");
  const excludeActive = url.searchParams.get("excludeActive") === "true";
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("limit") ?? 8) || 8),
  );
  const activeClause = excludeActive
    ? " AND NOT EXISTS (SELECT 1 FROM shopping_items i WHERE i.normalized_name=shopping_products.normalized_name AND i.is_checked=0)"
    : "";
  const result = await context.env.DB.prepare(
    "SELECT " +
      SHOPPING_PRODUCT_COLUMNS +
      " FROM shopping_products WHERE (?='' OR instr(normalized_name,?)>0)" +
      activeClause +
      " ORDER BY CASE WHEN ?<>'' AND substr(normalized_name,1,length(?))=? THEN 0 ELSE 1 END,times_added DESC,last_added_at DESC LIMIT ?",
  )
    .bind(query, query, query, query, query, limit)
    .all<ShoppingProductRow>();
  return success(result.results.map(toShoppingProduct));
}
