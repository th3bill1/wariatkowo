import type { CalendarEventType } from "./models";

export const CALENDAR_TYPES: ReadonlyArray<{
  value: CalendarEventType;
  label: string;
  icon: string;
}> = [
  { value: "event", label: "Wydarzenie", icon: "🎉" },
  { value: "appointment", label: "Wizyta", icon: "🩺" },
  { value: "guest", label: "Goście", icon: "👋" },
  { value: "trip", label: "Wyjazd", icon: "🧳" },
  { value: "birthday", label: "Urodziny", icon: "🎂" },
  { value: "anniversary", label: "Rocznica", icon: "❤️" },
  { value: "delivery", label: "Dostawa", icon: "📦" },
  { value: "bill", label: "Rachunek / termin", icon: "💸" },
  { value: "other", label: "Inne", icon: "📌" },
];
