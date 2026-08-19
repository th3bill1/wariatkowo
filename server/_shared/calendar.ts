import type { CalendarEvent, CalendarEventType } from "../../shared/models";

export const CALENDAR_EVENT_TYPES: CalendarEventType[] = [
  "event",
  "appointment",
  "guest",
  "trip",
  "birthday",
  "anniversary",
  "delivery",
  "bill",
  "other",
];
export const CALENDAR_COLUMNS =
  "e.id,e.title,e.description,e.type,e.start_date,e.end_date,e.all_day,e.created_by_member_id,e.created_at,e.updated_at,m.name AS created_by_name";
export type CalendarRow = {
  id: string;
  title: string;
  description: string | null;
  type: CalendarEventType;
  start_date: string;
  end_date: string | null;
  all_day: number;
  created_by_member_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};
export const toCalendarEvent = (row: CalendarRow): CalendarEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  type: row.type,
  startDate: row.start_date,
  endDate: row.end_date,
  allDay: Boolean(row.all_day),
  createdByMemberId: row.created_by_member_id,
  createdByName: row.created_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  source: "local",
  calendarSourceId: "local",
  calendarName: "Lokalne",
  sourceOwnerName: "Wariatkowo",
  calendarColor: null,
  location: null,
  organizer: null,
  attendees: [],
  htmlLink: null,
  hangoutLink: null,
  timeZone: null,
  eventType: null,
  recurring: false,
  canEdit: true,
  canDelete: true,
});
export const isCalendarEventType = (
  value: unknown,
): value is CalendarEventType =>
  typeof value === "string" &&
  CALENDAR_EVENT_TYPES.includes(value as CalendarEventType);
export function parseCalendarDate(
  value: unknown,
  allDay: boolean,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (allDay)
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) &&
      !Number.isNaN(Date.parse(trimmed + "T12:00:00Z"))
      ? trimmed
      : undefined;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}
