import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CreateTaskInput, Task, UpdateTaskInput } from '../../shared/models';
import { taskService } from '../services/taskService';

export type TaskLoadState = 'idle' | 'loading' | 'ready' | 'error';

function sortTasks(items: Task[]): Task[] {
  return [...items].sort((first, second) => {
    if (first.completed !== second.completed) {
      return Number(first.completed) - Number(second.completed);
    }

    const firstDue = first.dueDate ? Date.parse(first.dueDate) : Number.POSITIVE_INFINITY;
    const secondDue = second.dueDate ? Date.parse(second.dueDate) : Number.POSITIVE_INFINITY;
    if (firstDue !== secondDue) {
      return firstDue - secondDue;
    }

    if (first.sortOrder !== second.sortOrder) {
      return first.sortOrder - second.sortOrder;
    }

    return Date.parse(first.createdAt) - Date.parse(second.createdAt);
  });
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadState, setLoadState] = useState<TaskLoadState>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setError(null);

    try {
      const data = await taskService.getAll();
      setTasks(sortTasks(data));
      setLoadState('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać zadań.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createTask = useCallback(async (input: CreateTaskInput) => {
    const created = await taskService.create(input);
    setTasks((current) => sortTasks([created, ...current]));
    return created;
  }, []);

  const updateTask = useCallback(async (id: string, input: UpdateTaskInput) => {
    let previous: Task[] = [];
    setTasks((current) => {
      previous = current;
      return current.map((task) => (task.id === id ? { ...task, ...input } : task));
    });

    try {
      const updated = await taskService.update(id, input);
      setTasks((current) => sortTasks(current.map((task) => (task.id === id ? updated : task))));
      if (input.completed === true) {
        await load();
      }
      return updated;
    } catch (updateError) {
      setTasks(previous);
      throw updateError;
    }
  }, [load]);

  const removeTask = useCallback(async (id: string) => {
    let previous: Task[] = [];
    setTasks((current) => {
      previous = current;
      return current.filter((task) => task.id !== id);
    });

    try {
      await taskService.remove(id);
    } catch (removeError) {
      setTasks(previous);
      throw removeError;
    }
  }, []);

  return useMemo(
    () => ({
      tasks,
      loadState,
      error,
      refresh: load,
      createTask,
      updateTask,
      removeTask,
    }),
    [createTask, error, load, loadState, removeTask, tasks, updateTask],
  );
}
