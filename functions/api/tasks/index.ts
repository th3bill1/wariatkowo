import type { CreateTaskInput, Task } from "../../../shared/models";
import { isAuthResponse, requireAuth } from "../../_shared/auth";
import {
  error,
  isNonEmptyString,
  methodNotAllowed,
  nowIso,
  parseOptionalIsoDate,
  parseOptionalString,
  parseTrimmedString,
  readJsonBody,
  success,
  type Env,
} from "../../_shared/http";
import {
  isTaskAssignment,
  parseRecurrence,
  TASK_COLUMNS,
  toTask,
  type TaskRow,
} from "../../_shared/tasks";

const MAX_TITLE_LENGTH = 180;
const MAX_NOTES_LENGTH = 1500;

async function getTasks(env: Env): Promise<Task[]> {
  const result = await env.DB.prepare(
    "SELECT " +
      TASK_COLUMNS +
      " FROM tasks ORDER BY is_completed ASC, CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC, due_date ASC, sort_order ASC, created_at ASC",
  ).all<TaskRow>();
  return result.results.map(toTask);
}
async function createTask(env: Env, body: unknown): Promise<Response> {
  const input = body as Partial<CreateTaskInput>;
  const title = parseTrimmedString(input.title);
  const notes = parseOptionalString(input.notes);
  const dueDate = parseOptionalIsoDate(input.dueDate);
  const assignment = input.assignment ?? "anyone";
  const recurrence = parseRecurrence(input.recurrence);

  if (!isNonEmptyString(title))
    return error("VALIDATION_ERROR", "Nazwa zadania jest wymagana.");
  if (title.length > MAX_TITLE_LENGTH)
    return error("VALIDATION_ERROR", "Nazwa zadania jest za długa.");
  if (notes !== undefined && notes !== null && notes.length > MAX_NOTES_LENGTH)
    return error("VALIDATION_ERROR", "Notatka jest za długa.");
  if (input.dueDate !== undefined && dueDate === undefined)
    return error("VALIDATION_ERROR", "Termin ma niepoprawny format.");
  if (!isTaskAssignment(assignment))
    return error("VALIDATION_ERROR", "Niepoprawne przypisanie zadania.");
  if (input.recurrence !== undefined && recurrence === undefined)
    return error("VALIDATION_ERROR", "Niepoprawna częstotliwość powtarzania.");
  if (recurrence && !dueDate)
    return error("VALIDATION_ERROR", "Powtarzalne zadanie musi mieć termin.");

  const maxSort = await env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) AS value FROM tasks",
  ).first<{ value: number }>();
  const id = crypto.randomUUID(),
    timestamp = nowIso();
  const seriesId = recurrence ? crypto.randomUUID() : null;
  await env.DB.prepare(
    "INSERT INTO tasks (id,title,notes,due_date,is_completed,completed_at,sort_order,assignment,recurrence_unit,recurrence_interval,recurrence_series_id,generated_from_task_id,created_at,updated_at) VALUES (?,?,?,?,0,NULL,?,?,?,?,?,NULL,?,?)",
  )
    .bind(
      id,
      title,
      notes ?? null,
      dueDate ?? null,
      (maxSort?.value ?? -1) + 1,
      assignment,
      recurrence?.unit ?? null,
      recurrence?.interval ?? null,
      seriesId,
      timestamp,
      timestamp,
    )
    .run();
  const created = await env.DB.prepare(
    "SELECT " + TASK_COLUMNS + " FROM tasks WHERE id = ?",
  )
    .bind(id)
    .first<TaskRow>();
  return created
    ? success(toTask(created), { status: 201 })
    : error("INTERNAL_ERROR", "Nie udało się utworzyć zadania.", 500);
}
export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const auth = await requireAuth(context.request, context.env);
  if (isAuthResponse(auth)) return auth;
  if (context.request.method === "GET")
    return success(await getTasks(context.env));
  if (context.request.method === "POST") {
    try {
      return await createTask(context.env, await readJsonBody(context.request));
    } catch {
      return error(
        "VALIDATION_ERROR",
        "Treść żądania nie jest poprawnym JSON-em.",
      );
    }
  }
  return methodNotAllowed(["GET", "POST"]);
}
