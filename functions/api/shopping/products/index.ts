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
  const sort =
    url.searchParams.get("sort") === "recent" ? "recent" : "frequency";
  const order =
    sort === "recent"
      ? "last_added_at DESC,times_added DESC"
      : "times_added DESC,last_added_at DESC";
  const result = await context.env.DB.prepare(
    "SELECT " +
      SHOPPING_PRODUCT_COLUMNS +
      " FROM shopping_products WHERE ? = '' OR instr(normalized_name,?) > 0 ORDER BY " +
      order +
      " LIMIT 200",
  )
    .bind(query, query)
    .all<ShoppingProductRow>();
  return success(result.results.map(toShoppingProduct));
}
