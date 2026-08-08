import { isAuthResponse, requireAuth } from "../../_shared/auth";
import type {
  CreateShoppingItemInput,
  ShoppingItem,
} from "../../../shared/models";
import { normalizeProductName } from "../../../shared/shopping";
import {
  error,
  isNonEmptyString,
  methodNotAllowed,
  nowIso,
  parseOptionalString,
  parseTrimmedString,
  readJsonBody,
  success,
  type Env,
} from "../../_shared/http";
import type { ShoppingRow } from "../../_shared/shopping";
import { toShoppingItem } from "../../_shared/shopping";

const MAX_NAME_LENGTH = 180,
  MAX_QUANTITY_LENGTH = 60,
  MAX_CATEGORY_LENGTH = 100;

async function getShoppingItems(env: Env): Promise<ShoppingItem[]> {
  const result = await env.DB.prepare(
    "SELECT id,name,quantity,category,is_checked,checked_at,sort_order,created_at,updated_at FROM shopping_items ORDER BY is_checked ASC,sort_order ASC,created_at ASC",
  ).all<ShoppingRow>();
  return result.results.map(toShoppingItem);
}
async function createShoppingItem(env: Env, body: unknown): Promise<Response> {
  const input = body as Partial<CreateShoppingItemInput>;
  const name = parseTrimmedString(input.name);
  const quantity = parseOptionalString(input.quantity);
  const category = parseOptionalString(input.category);
  const normalizedName = normalizeProductName(name);
  if (!isNonEmptyString(name))
    return error("VALIDATION_ERROR", "Nazwa produktu jest wymagana.");
  if (name.length > MAX_NAME_LENGTH)
    return error("VALIDATION_ERROR", "Nazwa produktu jest za długa.");
  if (
    quantity !== undefined &&
    quantity !== null &&
    quantity.length > MAX_QUANTITY_LENGTH
  )
    return error("VALIDATION_ERROR", "Ilość jest za długa.");
  if (
    category !== undefined &&
    category !== null &&
    category.length > MAX_CATEGORY_LENGTH
  )
    return error("VALIDATION_ERROR", "Kategoria jest za długa.");
  if (input.allowDuplicate !== true) {
    const duplicate = await env.DB.prepare(
      "SELECT name FROM shopping_items WHERE normalized_name = ? AND is_checked = 0 LIMIT 1",
    )
      .bind(normalizedName)
      .first<{ name: string }>();
    if (duplicate)
      return error("DUPLICATE", duplicate.name + " już tu jest 👀", 409);
  }
  const maxSort = await env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order),-1) AS value FROM shopping_items",
  ).first<{ value: number }>();
  const id = crypto.randomUUID(),
    timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO shopping_items (id,name,normalized_name,quantity,category,is_checked,checked_at,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,0,NULL,?,?,?)",
    ).bind(
      id,
      name,
      normalizedName,
      quantity ?? null,
      category ?? null,
      (maxSort?.value ?? -1) + 1,
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      "INSERT INTO shopping_products (id,name,normalized_name,default_category,times_added,last_added_at,created_at) VALUES (?,?,?,?,1,?,?) ON CONFLICT(normalized_name) DO UPDATE SET name=excluded.name,default_category=COALESCE(excluded.default_category,shopping_products.default_category),times_added=shopping_products.times_added+1,last_added_at=excluded.last_added_at",
    ).bind(
      crypto.randomUUID(),
      name,
      normalizedName,
      category ?? null,
      timestamp,
      timestamp,
    ),
  ]);
  const created = await env.DB.prepare(
    "SELECT id,name,quantity,category,is_checked,checked_at,sort_order,created_at,updated_at FROM shopping_items WHERE id=?",
  )
    .bind(id)
    .first<ShoppingRow>();
  return created
    ? success(toShoppingItem(created), { status: 201 })
    : error("INTERNAL_ERROR", "Nie udało się utworzyć pozycji zakupów.", 500);
}
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  if (context.request.method === "GET")
    return success(await getShoppingItems(context.env));
  if (context.request.method === "POST") {
    let body: unknown;
    try {
      body = await readJsonBody(context.request);
    } catch {
      return error(
        "VALIDATION_ERROR",
        "Treść żądania nie jest poprawnym JSON-em.",
      );
    }
    return createShoppingItem(context.env, body);
  }
  return methodNotAllowed(["GET", "POST"]);
}
