import type { UpdateTaskInput } from '../../../shared/models';
import { error, isNonEmptyString, methodNotAllowed, nowIso, parseOptionalIsoDate, parseOptionalNumber, parseOptionalString, parseTrimmedString, readJsonBody, success, type Env } from '../../_shared/http';
import type { TaskRow } from '../../_shared/tasks';
import { toTask } from '../../_shared/tasks';

const MAX_TITLE_LENGTH = 180;
const MAX_NOTES_LENGTH = 1500;

async function loadTask(env: Env, id: string): Promise<TaskRow | null> {
  return env.DB.prepare(
    `SELECT id, title, notes, due_date, is_completed, completed_at, sort_order, created_at, updated_at
     FROM tasks
     WHERE id = ?`,
  )
    .bind(id)
    .first<TaskRow>();
}

async function updateTask(env: Env, id: string, body: unknown): Promise<Response> {
  const current = await loadTask(env, id);
  if (!current) {
    return error('NOT_FOUND', 'Zadanie nie istnieje.', 404);
  }

  const input = body as Partial<UpdateTaskInput>;
  const nextTitle = input.title === undefined ? current.title : parseTrimmedString(input.title);
  const nextNotes = input.notes === undefined ? current.notes : parseOptionalString(input.notes);
  const nextDueDate = input.dueDate === undefined ? current.due_date : parseOptionalIsoDate(input.dueDate);
  const nextCompleted = input.completed === undefined ? current.is_completed === 1 : Boolean(input.completed);
  const nextSortOrder = input.sortOrder === undefined ? current.sort_order : parseOptionalNumber(input.sortOrder);

  if (!isNonEmptyString(nextTitle)) {
    return error('VALIDATION_ERROR', 'Nazwa zadania jest wymagana.');
  }

  if (nextTitle.length > MAX_TITLE_LENGTH) {
    return error('VALIDATION_ERROR', 'Nazwa zadania jest za długa.');
  }

  if (nextNotes !== undefined && nextNotes !== null && nextNotes.length > MAX_NOTES_LENGTH) {
    return error('VALIDATION_ERROR', 'Notatka jest za długa.');
  }

  if (input.dueDate !== undefined && nextDueDate === undefined) {
    return error('VALIDATION_ERROR', 'Termin ma niepoprawny format.');
  }

  if (input.sortOrder !== undefined && nextSortOrder === undefined) {
    return error('VALIDATION_ERROR', 'Kolejność musi być liczbą.');
  }

  const changedFromIncompleteToComplete = current.is_completed === 0 && nextCompleted;
  const changedFromCompleteToIncomplete = current.is_completed === 1 && !nextCompleted;
  const nextCompletedAt = changedFromIncompleteToComplete
    ? nowIso()
    : changedFromCompleteToIncomplete
      ? null
      : current.completed_at;
  const timestamp = nowIso();

  await env.DB.prepare(
    `UPDATE tasks
     SET title = ?,
         notes = ?,
         due_date = ?,
         is_completed = ?,
         completed_at = ?,
         sort_order = ?,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      nextTitle,
      nextNotes ?? null,
      nextDueDate ?? null,
      nextCompleted ? 1 : 0,
      nextCompletedAt,
      nextSortOrder ?? current.sort_order,
      timestamp,
      id,
    )
    .run();

  const updated = await loadTask(env, id);
  if (!updated) {
    return error('INTERNAL_ERROR', 'Nie udało się zaktualizować zadania.', 500);
  }

  return success(toTask(updated));
}

export async function onRequest(context: { request: Request; env: Env; params: { id?: string } }): Promise<Response> {
  const id = context.params.id;
  if (!id) {
    return error('VALIDATION_ERROR', 'Brak identyfikatora zadania.');
  }

  if (context.request.method === 'PATCH') {
    try {
      const body = await readJsonBody(context.request);
      return await updateTask(context.env, id, body);
    } catch {
      return error('VALIDATION_ERROR', 'Treść żądania nie jest poprawnym JSON-em.');
    }
  }

  if (context.request.method === 'DELETE') {
    const existing = await loadTask(context.env, id);
    if (!existing) {
      return error('NOT_FOUND', 'Zadanie nie istnieje.', 404);
    }

    await context.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
    return success({ deleted: true });
  }

  return methodNotAllowed(['PATCH', 'DELETE']);
}
