import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../shared/models";
import {
  calendarDateKey,
  eventEndDateKey,
  eventsOnDate,
  eventStartDateKey,
  groupEventsByStartDate,
  monthCells,
  relativeDateLabel,
} from "../src/utils/calendarView";

function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    title: "Wyjazd",
    description: null,
    type: "trip",
    startDate: "2026-08-20",
    endDate: "2026-08-22",
    allDay: true,
    createdByMemberId: "member-misiek",
    createdByName: "Misiek",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
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
    ...overrides,
  };
}

describe("calendar view transformations", () => {
  it("keeps all-day dates independent of timezone conversion", () => {
    const event = calendarEvent();

    expect(eventStartDateKey(event)).toBe("2026-08-20");
    expect(eventEndDateKey(event)).toBe("2026-08-22");
    expect(eventsOnDate([event], "2026-08-21")).toEqual([event]);
    expect(eventsOnDate([event], "2026-08-23")).toEqual([]);
  });

  it("groups upcoming events by their start day without reordering", () => {
    const first = calendarEvent();
    const second = calendarEvent({ id: "event-2", title: "Drugi" });

    expect(groupEventsByStartDate([first, second]).get("2026-08-20")).toEqual([
      first,
      second,
    ]);
  });

  it("builds a Monday-first month grid", () => {
    const cells = monthCells(new Date(2026, 7, 15));

    expect(cells.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(calendarDateKey(cells[5]!)).toBe("2026-08-01");
    expect(calendarDateKey(cells.at(-1)!)).toBe("2026-08-31");
  });

  it("labels today and tomorrow explicitly", () => {
    const today = new Date(2026, 7, 19, 8);

    expect(relativeDateLabel("2026-08-19", today)).toBe("Dzisiaj");
    expect(relativeDateLabel("2026-08-20", today)).toBe("Jutro");
  });
});
