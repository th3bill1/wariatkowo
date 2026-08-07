import type { CreateTaskInput, Task, UpdateTaskInput } from '../../shared/models';
import { requestJson, requestVoid } from './http';

const TASKS_ENDPOINT = '/api/tasks';

export const taskService = {
  getAll(): Promise<Task[]> {
    return requestJson<Task[]>(TASKS_ENDPOINT);
  },

  create(input: CreateTaskInput): Promise<Task> {
    return requestJson<Task>(TASKS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: UpdateTaskInput): Promise<Task> {
    return requestJson<Task>(`${TASKS_ENDPOINT}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  },

  remove(id: string): Promise<void> {
    return requestVoid(`${TASKS_ENDPOINT}/${id}`, {
      method: 'DELETE',
    });
  },
};
