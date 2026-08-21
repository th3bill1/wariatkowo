import type { CalendarEvent } from "../../../shared/models";

export function dateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateTimeValue(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function dateFromInput(value: string, withTime = false): Date {
  if (!value) return new Date();
  return new Date(withTime ? value : `${value}T12:00:00`);
}

export function formatPolishDate(value: string, includeTime = false): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("pl-PL", options).format(new Date(value));
}

export function relativeDateLabel(value: string, today = new Date()): string {
  const key = value.slice(0, 10);
  const delta = Math.round(
    (Date.parse(`${key}T12:00:00`) - Date.parse(`${dateKey(today)}T12:00:00`)) /
      86_400_000,
  );
  if (delta === 0) return "Dzisiaj";
  if (delta === 1) return "Jutro";
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${key}T12:00:00`));
}

export function eventEndDateKey(event: CalendarEvent): string {
  if (!event.endDate) return event.startDate.slice(0, 10);
  return event.endDate.slice(0, 10);
}

export function eventTimeLabel(event: CalendarEvent): string {
  return event.allDay
    ? "Cały dzień"
    : new Intl.DateTimeFormat("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(event.startDate));
}

export function relativeTime(value: string): string {
  const hours = Math.floor((Date.now() - Date.parse(value)) / 3_600_000);
  if (hours < 1) return "przed chwilą";
  if (hours < 24) return `${hours} godz. temu`;
  if (hours < 48) return "wczoraj";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
