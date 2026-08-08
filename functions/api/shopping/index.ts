import { isAuthResponse, requireAuth } from "../../_shared/auth";
import type {
  CreateShoppingItemInput,
  ShoppingItem,
} from "../../../shared/models";
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

const MAX_NAME_LENGTH = 180;
const MAX_QUANTITY_LENGTH = 60;
const MAX_CATEGORY_LENGTH = 100;

async function getShoppingItems(env: Env): Promise<ShoppingItem[]> {
  const result = await env.DB.prepare(
    `SELECT id, name, quantity, category, is_checked, checked_at, sort_order, created_at, updated_at
     FROM shopping_items
     ORDER BY
       is_checked ASC,
       sort_order ASC,
       created_at ASC`,
  ).all<ShoppingRow>();

  return result.results.map(toShoppingItem);
}

async function createShoppingItem(env: Env, body: unknown): Promise<Response> {
  const input = body as Partial<CreateShoppingItemInput>;
  const name = parseTrimmedString(input.name);
  const quantity = parseOptionalString(input.quantity);
  const category = parseOptionalString(input.category);

  if (!isNonEmptyString(name)) {
    return error("VALIDATION_ERROR", "Nazwa produktu jest wymagana.");
  }

  if (name.length > MAX_NAME_LENGTH) {
    return error("VALIDATION_ERROR", "Nazwa produktu jest za długa.");
  }

  if (
    quantity !== undefined &&
    quantity !== null &&
    quantity.length > MAX_QUANTITY_LENGTH
  ) {
    return error("VALIDATION_ERROR", "Ilość jest za długa.");
  }

  if (
    category !== undefined &&
    category !== null &&
    category.length > MAX_CATEGORY_LENGTH
  ) {
    return error("VALIDATION_ERROR", "Kategoria jest za długa.");
  }

  const maxSort = await env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order FROM shopping_items",
  ).first<{
    max_sort_order: number;
  }>();

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const sortOrder = (maxSort?.max_sort_order ?? -1) + 1;

  await env.DB.prepare(
    `INSERT INTO shopping_items (id, name, quantity, category, is_checked, checked_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
  )
    .bind(
      id,
      name,
      quantity ?? null,
      category ?? null,
      sortOrder,
      timestamp,
      timestamp,
    )
    .run();

  const created = await env.DB.prepare(
    `SELECT id, name, quantity, category, is_checked, checked_at, sort_order, created_at, updated_at
     FROM shopping_items
     WHERE id = ?`,
  )
    .bind(id)
    .first<ShoppingRow>();

  if (!created) {
    return error(
      "INTERNAL_ERROR",
      "Nie udało się utworzyć pozycji zakupów.",
      500,
    );
  }

  return success(toShoppingItem(created), { status: 201 });
}

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  if (context.request.method === "GET") {
    const items = await getShoppingItems(context.env);
    return success(items);
  }

  if (context.request.method === "POST") {
    try {
      const body = await readJsonBody(context.request);
      return await createShoppingItem(context.env, body);
    } catch {
      return error(
        "VALIDATION_ERROR",
        "Treść żądania nie jest poprawnym JSON-em.",
      );
    }
  }

  return methodNotAllowed(["GET", "POST"]);
}
