import type {
  CalendarEvent,
  CalendarSource,
  CreateCalendarEventInput,
  GoogleCalendarConnectionStatus,
  UpdateCalendarEventInput,
} from "../../shared/models";
import { requestJson, requestJsonBody, requestVoid } from "./http";
const endpoint = "/api/calendar";
export const calendarService = {
  list(from: string, to: string) {
    return requestJson<CalendarEvent[]>(
      `${endpoint}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
  },
  create(input: CreateCalendarEventInput) {
    return requestJsonBody<CalendarEvent>(endpoint, "POST", input);
  },
  update(id: string, input: UpdateCalendarEventInput) {
    return requestJsonBody<CalendarEvent>(`${endpoint}/${id}`, "PATCH", input);
  },
  remove(id: string) {
    return requestVoid(`${endpoint}/${id}`, { method: "DELETE" });
  },
  sources() {
    return requestJson<CalendarSource[]>(`${endpoint}/calendars`);
  },
  connectionStatus() {
    return requestJson<GoogleCalendarConnectionStatus>(
      "/api/integrations/google-calendar/status",
    );
  },
  synchronize() {
    return requestJson<{ synchronized: number; errors: number }>(
      "/api/integrations/google-calendar/sync",
      { method: "POST" },
    );
  },
  disconnectGoogle() {
    return requestJson<{ disconnected: boolean }>(
      "/api/integrations/google-calendar/disconnect",
      { method: "POST" },
    );
  },
};
