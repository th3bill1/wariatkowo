import type { Task } from '../../shared/models';

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  is_completed: number;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    completed: row.is_completed === 1,
    completedAt: row.completed_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
