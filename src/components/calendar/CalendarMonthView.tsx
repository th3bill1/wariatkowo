import type { CSSProperties } from "react";
import type { CalendarEvent } from "../../../shared/models";
import {
  calendarDateKey,
  eventColor,
  eventEndDateKey,
  eventsOnDate,
  eventStartDateKey,
  eventTypeMeta,
  monthCells,
} from "../../utils/calendarView";
import { AppCard } from "../ui/AppCard";

type CalendarMonthViewProps = {
  cursor: Date;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  today: Date;
};

export function CalendarMonthView({
  cursor,
  events,
  onSelect,
  today,
}: CalendarMonthViewProps) {
  return (
    <AppCard className="month-card">
      <div className="month-weekdays">
        {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="month-grid">
        {monthCells(cursor).map((date, index) => {
          const key = date ? calendarDateKey(date) : "";
          const dayEvents = date ? eventsOnDate(events, key).slice(0, 3) : [];
          return (
            <div
              className={
                !date
                  ? "month-day month-day--empty"
                  : key === calendarDateKey(today)
                    ? "month-day month-day--today"
                    : "month-day"
              }
              key={date?.toISOString() ?? `empty-${index}`}
            >
              {date ? (
                <>
                  <strong>{date.getDate()}</strong>
                  {dayEvents.map((event) => {
                    const start = eventStartDateKey(event);
                    const end = eventEndDateKey(event);
                    const position =
                      start === end
                        ? "single"
                        : key === start
                          ? "start"
                          : key === end
                            ? "end"
                            : "middle";
                    return (
                      <button
                        className={`month-event month-event--${position}`}
                        key={event.id}
                        onClick={() => onSelect(event)}
                        style={
                          {
                            "--event-color": eventColor(event),
                          } as CSSProperties
                        }
                        title={`${event.title} · ${event.sourceOwnerName} · ${event.calendarName}`}
                        type="button"
                      >
                        <span>
                          {position === "middle"
                            ? ""
                            : eventTypeMeta(event).icon}
                        </span>
                        <span className="month-event__title">
                          {position === "middle" ? "" : event.title}
                        </span>
                        {position === "start" ? (
                          <small>początek</small>
                        ) : position === "end" ? (
                          <small>koniec</small>
                        ) : null}
                      </button>
                    );
                  })}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </AppCard>
  );
}
