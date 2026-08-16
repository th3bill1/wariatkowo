import { describe, expect, it } from "vitest";
import {
  isCalendarEventType,
  parseCalendarDate,
} from "../server/_shared/calendar";
describe("calendar rules", () => {
  it("accepts supported event types", () => {
    expect(isCalendarEventType("birthday")).toBe(true);
    expect(isCalendarEventType("meeting")).toBe(false);
  });
  it("keeps all-day dates date-only", () => {
    expect(parseCalendarDate("2026-08-12", true)).toBe("2026-08-12");
    expect(parseCalendarDate("12/08/2026", true)).toBeUndefined();
  });
  it("normalizes timed events to UTC ISO", () => {
    expect(parseCalendarDate("2026-08-12T18:00:00+02:00", false)).toBe(
      "2026-08-12T16:00:00.000Z",
    );
  });
});
