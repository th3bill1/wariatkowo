import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "../../shared/models";
import { requestJson, requestVoid } from "./http";
const endpoint = "/api/calendar";
export const calendarService = {
  list(from: string, to: string) {
    return requestJson<CalendarEvent[]>(
      `${endpoint}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
  },
  create(input: CreateCalendarEventInput) {
    return requestJson<CalendarEvent>(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: UpdateCalendarEventInput) {
    return requestJson<CalendarEvent>(`${endpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  },
  remove(id: string) {
    return requestVoid(`${endpoint}/${id}`, { method: "DELETE" });
  },
};
