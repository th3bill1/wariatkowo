import type { CreateTaskInput, Task } from '../../../shared/models';
import { error, isNonEmptyString, methodNotAllowed, nowIso, parseOptionalIsoDate, parseOptionalString, parseTrimmedString, readJsonBody, success, type Env } from '../../_shared/http';
import type { TaskRow } from '../../_shared/tasks';
import { toTask } from '../../_shared/tasks';

const MAX_TITLE_LENGTH = 180;
const MAX_NOTES_LENGTH = 1500;

async function getTasks(env: Env): Promise<Task[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, notes, due_date, is_completed, completed_at, sort_order, created_at, updated_at
     FROM tasks
     ORDER BY
       is_completed ASC,
       CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
       due_date ASC,
       sort_order ASC,
       created_at ASC`,
  ).all<TaskRow>();

  return result.results.map(toTask);
}

async function createTask(env: Env, body: unknown): Promise<Response> {
  const input = body as Partial<CreateTaskInput>;
  const title = parseTrimmedString(input.title);
  const notes = parseOptionalString(input.notes);
  const dueDate = parseOptionalIsoDate(input.dueDate);

  if (!isNonEmptyString(title)) {
    return error('VALIDATION_ERROR', 'Nazwa zadania jest wymagana.');
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return error('VALIDATION_ERROR', 'Nazwa zadania jest za długa.');
  }

  if (notes !== undefined && notes !== null && notes.length > MAX_NOTES_LENGTH) {
    return error('VALIDATION_ERROR', 'Notatka jest za długa.');
  }

  if (input.dueDate !== undefined && dueDate === undefined) {
    return error('VALIDATION_ERROR', 'Termin ma niepoprawny format.');
  }

  const maxSort = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order FROM tasks').first<{
    max_sort_order: number;
  }>();

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const sortOrder = (maxSort?.max_sort_order ?? -1) + 1;

  await env.DB.prepare(
    `INSERT INTO tasks (id, title, notes, due_date, is_completed, completed_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, ?)`,
  )
    .bind(id, title, notes ?? null, dueDate ?? null, sortOrder, timestamp, timestamp)
    .run();

  const created = await env.DB.prepare(
    `SELECT id, title, notes, due_date, is_completed, completed_at, sort_order, created_at, updated_at
     FROM tasks
     WHERE id = ?`,
  )
    .bind(id)
    .first<TaskRow>();

  if (!created) {
    return error('INTERNAL_ERROR', 'Nie udało się utworzyć zadania.', 500);
  }

  return success(toTask(created), { status: 201 });
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (context.request.method === 'GET') {
    const tasks = await getTasks(context.env);
    return success(tasks);
  }

  if (context.request.method === 'POST') {
    try {
      const body = await readJsonBody(context.request);
      return await createTask(context.env, body);
    } catch {
      return error('VALIDATION_ERROR', 'Treść żądania nie jest poprawnym JSON-em.');
    }
  }

  return methodNotAllowed(['GET', 'POST']);
}
