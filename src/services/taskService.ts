import type {
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "../../shared/models";
import { requestJson, requestJsonBody, requestVoid } from "./http";

const TASKS_ENDPOINT = "/api/tasks";

export const taskService = {
  getAll(): Promise<Task[]> {
    return requestJson<Task[]>(TASKS_ENDPOINT);
  },

  create(input: CreateTaskInput): Promise<Task> {
    return requestJsonBody<Task>(TASKS_ENDPOINT, "POST", input);
  },

  update(id: string, input: UpdateTaskInput): Promise<Task> {
    return requestJsonBody<Task>(`${TASKS_ENDPOINT}/${id}`, "PATCH", input);
  },

  remove(id: string): Promise<void> {
    return requestVoid(`${TASKS_ENDPOINT}/${id}`, {
      method: "DELETE",
    });
  },
};
