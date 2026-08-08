import type {
  RecurrenceUnit,
  Task,
  TaskAssignment,
  TaskRecurrence,
} from "../../shared/models";

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  is_completed: number;
  completed_at: string | null;
  sort_order: number;
  assignment: TaskAssignment;
  recurrence_unit: RecurrenceUnit | null;
  recurrence_interval: number | null;
  recurrence_series_id: string | null;
  generated_from_task_id: string | null;
  created_at: string;
  updated_at: string;
};
export const TASK_COLUMNS =
  "id, title, notes, due_date, is_completed, completed_at, sort_order, assignment, recurrence_unit, recurrence_interval, recurrence_series_id, generated_from_task_id, created_at, updated_at";

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    completed: row.is_completed === 1,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    assignment: row.assignment,
    recurrence:
      row.recurrence_unit && row.recurrence_interval
        ? { unit: row.recurrence_unit, interval: row.recurrence_interval }
        : null,
    recurrenceSeriesId: row.recurrence_series_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function isTaskAssignment(value: unknown): value is TaskAssignment {
  return (
    value === "anyone" ||
    value === "misiek" ||
    value === "miska" ||
    value === "both"
  );
}
export function parseRecurrence(
  value: unknown,
): TaskRecurrence | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<TaskRecurrence>;
  if (
    (candidate.unit !== "day" &&
      candidate.unit !== "week" &&
      candidate.unit !== "month") ||
    !Number.isInteger(candidate.interval) ||
    !candidate.interval ||
    candidate.interval < 1 ||
    candidate.interval > 365
  )
    return undefined;
  return { unit: candidate.unit, interval: candidate.interval };
}
export function calculateNextDueDate(
  dueDate: string,
  recurrence: TaskRecurrence,
): string {
  const date = new Date(dueDate);
  if (recurrence.unit === "day")
    date.setUTCDate(date.getUTCDate() + recurrence.interval);
  if (recurrence.unit === "week")
    date.setUTCDate(date.getUTCDate() + 7 * recurrence.interval);
  if (recurrence.unit === "month") {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + recurrence.interval);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDay));
  }
  return date.toISOString();
}

export function isCompletionTransition(
  wasCompleted: boolean,
  willBeCompleted: boolean,
): boolean {
  return !wasCompleted && willBeCompleted;
}

export function isUncompletionTransition(
  wasCompleted: boolean,
  willBeCompleted: boolean,
): boolean {
  return wasCompleted && !willBeCompleted;
}
