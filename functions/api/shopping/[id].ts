import type { UpdateShoppingItemInput } from '../../../shared/models';
import { error, isNonEmptyString, methodNotAllowed, nowIso, parseOptionalNumber, parseOptionalString, parseTrimmedString, readJsonBody, success, type Env } from '../../_shared/http';
import type { ShoppingRow } from '../../_shared/shopping';
import { toShoppingItem } from '../../_shared/shopping';

const MAX_NAME_LENGTH = 180;
const MAX_QUANTITY_LENGTH = 60;
const MAX_CATEGORY_LENGTH = 100;

async function loadItem(env: Env, id: string): Promise<ShoppingRow | null> {
  return env.DB.prepare(
    `SELECT id, name, quantity, category, is_checked, checked_at, sort_order, created_at, updated_at
     FROM shopping_items
     WHERE id = ?`,
  )
    .bind(id)
    .first<ShoppingRow>();
}

async function updateItem(env: Env, id: string, body: unknown): Promise<Response> {
  const current = await loadItem(env, id);
  if (!current) {
    return error('NOT_FOUND', 'Pozycja zakupów nie istnieje.', 404);
  }

  const input = body as Partial<UpdateShoppingItemInput>;
  const nextName = input.name === undefined ? current.name : parseTrimmedString(input.name);
  const nextQuantity = input.quantity === undefined ? current.quantity : parseOptionalString(input.quantity);
  const nextCategory = input.category === undefined ? current.category : parseOptionalString(input.category);
  const nextChecked = input.checked === undefined ? current.is_checked === 1 : Boolean(input.checked);
  const nextSortOrder = input.sortOrder === undefined ? current.sort_order : parseOptionalNumber(input.sortOrder);

  if (!isNonEmptyString(nextName)) {
    return error('VALIDATION_ERROR', 'Nazwa produktu jest wymagana.');
  }

  if (nextName.length > MAX_NAME_LENGTH) {
    return error('VALIDATION_ERROR', 'Nazwa produktu jest za długa.');
  }

  if (nextQuantity !== undefined && nextQuantity !== null && nextQuantity.length > MAX_QUANTITY_LENGTH) {
    return error('VALIDATION_ERROR', 'Ilość jest za długa.');
  }

  if (nextCategory !== undefined && nextCategory !== null && nextCategory.length > MAX_CATEGORY_LENGTH) {
    return error('VALIDATION_ERROR', 'Kategoria jest za długa.');
  }

  if (input.sortOrder !== undefined && nextSortOrder === undefined) {
    return error('VALIDATION_ERROR', 'Kolejność musi być liczbą.');
  }

  const changedToChecked = current.is_checked === 0 && nextChecked;
  const changedToUnchecked = current.is_checked === 1 && !nextChecked;
  const nextCheckedAt = changedToChecked ? nowIso() : changedToUnchecked ? null : current.checked_at;
  const timestamp = nowIso();

  await env.DB.prepare(
    `UPDATE shopping_items
     SET name = ?,
         quantity = ?,
         category = ?,
         is_checked = ?,
         checked_at = ?,
         sort_order = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      nextName,
      nextQuantity ?? null,
      nextCategory ?? null,
      nextChecked ? 1 : 0,
      nextCheckedAt,
      nextSortOrder ?? current.sort_order,
      timestamp,
      id,
    )
    .run();

  const updated = await loadItem(env, id);
  if (!updated) {
    return error('INTERNAL_ERROR', 'Nie udało się zaktualizować pozycji zakupów.', 500);
  }

  return success(toShoppingItem(updated));
}

export async function onRequest(context: { request: Request; env: Env; params: { id?: string } }): Promise<Response> {
  const id = context.params.id;
  if (!id) {
    return error('VALIDATION_ERROR', 'Brak identyfikatora pozycji.');
  }

  if (context.request.method === 'PATCH') {
    try {
      const body = await readJsonBody(context.request);
      return await updateItem(context.env, id, body);
    } catch {
      return error('VALIDATION_ERROR', 'Treść żądania nie jest poprawnym JSON-em.');
    }
  }

  if (context.request.method === 'DELETE') {
    const existing = await loadItem(context.env, id);
    if (!existing) {
      return error('NOT_FOUND', 'Pozycja zakupów nie istnieje.', 404);
    }

    await context.env.DB.prepare('DELETE FROM shopping_items WHERE id = ?').bind(id).run();
    return success({ deleted: true });
  }

  return methodNotAllowed(['PATCH', 'DELETE']);
}
