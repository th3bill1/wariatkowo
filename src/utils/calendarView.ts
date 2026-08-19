import type { CalendarEvent } from "../../shared/models";
import { CALENDAR_TYPES } from "../content/calendar";

const EVENT_COLORS = [
  "#7c5caf",
  "#d15f7a",
  "#4f8da8",
  "#4f9467",
  "#d18b36",
  "#bd5a68",
  "#6e83bd",
  "#a66a45",
  "#778089",
];

export function calendarDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function eventStartDateKey(event: CalendarEvent): string {
  return event.allDay
    ? event.startDate.slice(0, 10)
    : calendarDateKey(new Date(event.startDate));
}

export function eventEndDateKey(event: CalendarEvent): string {
  if (!event.endDate) return eventStartDateKey(event);
  return event.allDay
    ? event.endDate.slice(0, 10)
    : calendarDateKey(new Date(event.endDate));
}

export function eventTimeLabel(event: CalendarEvent): string {
  return event.allDay
    ? "Cały dzień"
    : new Intl.DateTimeFormat("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(event.startDate));
}

export function eventTypeMeta(event: CalendarEvent) {
  return (
    CALENDAR_TYPES.find((item) => item.value === event.type) ??
    CALENDAR_TYPES[0]
  );
}

export function eventColor(event: CalendarEvent): string {
  if (event.calendarColor) return event.calendarColor;
  const typeIndex = CALENDAR_TYPES.findIndex(
    (item) => item.value === event.type,
  );
  return EVENT_COLORS[Math.max(0, typeIndex)];
}

export function monthCells(cursor: Date): Array<Date | null> {
  const result: Array<Date | null> = [];
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const offset = (monthStart.getDay() + 6) % 7;

  for (let index = 0; index < offset; index += 1) result.push(null);
  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    result.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  }
  return result;
}

export function eventsOnDate(
  events: CalendarEvent[],
  date: string,
): CalendarEvent[] {
  return events.filter(
    (event) =>
      eventStartDateKey(event) <= date && eventEndDateKey(event) >= date,
  );
}

export function groupEventsByStartDate(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventStartDateKey(event);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  return grouped;
}

export function relativeDateLabel(date: string, today: Date): string {
  const delta = Math.round(
    (Date.parse(`${date}T12:00:00`) -
      Date.parse(`${calendarDateKey(today)}T12:00:00`)) /
      86_400_000,
  );
  if (delta === 0) return "Dzisiaj";
  if (delta === 1) return "Jutro";
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}
