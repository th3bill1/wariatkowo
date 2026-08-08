import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { CalendarEvent } from "../../shared/models";
import { CalendarEventForm } from "../components/calendar/CalendarEventForm";
import { AppCard } from "../components/ui/AppCard";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { CALENDAR_COPY, CALENDAR_TYPES } from "../content/calendar";
import { useCalendar } from "../hooks/useCalendar";
const dateKey = (date: Date) => {
  const year = date.getFullYear(),
    month = String(date.getMonth() + 1).padStart(2, "0"),
    day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const eventKey = (event: CalendarEvent) =>
  event.allDay
    ? event.startDate.slice(0, 10)
    : dateKey(new Date(event.startDate));
const eventTime = (event: CalendarEvent) =>
  event.allDay
    ? "Cały dzień"
    : new Intl.DateTimeFormat("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(event.startDate));
const typeMeta = (event: CalendarEvent) =>
  CALENDAR_TYPES.find((item) => item.value === event.type) ?? CALENDAR_TYPES[0];
const eventEndKey = (event: CalendarEvent) =>
  event.endDate
    ? event.allDay
      ? event.endDate.slice(0, 10)
      : dateKey(new Date(event.endDate))
    : eventKey(event);
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
const eventColor = (event: CalendarEvent) =>
  EVENT_COLORS[
    Math.max(
      0,
      CALENDAR_TYPES.findIndex((item) => item.value === event.type),
    )
  ];
export function CalendarPage() {
  const location = useLocation();
  const [cursor, setCursor] = useState(() => new Date()),
    [mode, setMode] = useState<"month" | "upcoming">("month"),
    [formOpen, setFormOpen] = useState(
      () => new URLSearchParams(location.search).get("add") === "1",
    ),
    [editing, setEditing] = useState<CalendarEvent | null>(null),
    [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1),
    monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0),
    today = new Date(),
    from =
      mode === "month"
        ? dateKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
        : dateKey(today),
    to =
      mode === "month"
        ? dateKey(monthEnd)
        : dateKey(
            new Date(
              today.getFullYear(),
              today.getMonth() + 3,
              today.getDate(),
            ),
          );
  const { events, loading, error, refresh, create, update, remove } =
    useCalendar(from, to);
  const cells = useMemo(() => {
    const result: Array<Date | null> = [],
      offset = (monthStart.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) result.push(null);
    for (let day = 1; day <= monthEnd.getDate(); day++)
      result.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    return result;
  }, [cursor.getFullYear(), cursor.getMonth()]);
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = eventKey(event);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);
  const eventsOnDay = (key: string) =>
    events.filter(
      (event) => eventKey(event) <= key && eventEndKey(event) >= key,
    );
  const label = (key: string) => {
    const delta = Math.round(
      (Date.parse(key + "T12:00:00") -
        Date.parse(dateKey(today) + "T12:00:00")) /
        86400000,
    );
    if (delta === 0) return "Dzisiaj";
    if (delta === 1) return "Jutro";
    return new Intl.DateTimeFormat("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(key + "T12:00:00"));
  };
  const beginEdit = (event: CalendarEvent) => {
    setEditing(event);
    setFormOpen(true);
  };
  return (
    <div className="content-stack calendar-page">
      <PageHeader
        eyebrow="Wspólne plany"
        title={CALENDAR_COPY.heading}
        description={CALENDAR_COPY.description}
        actions={
          <button
            className="primary-button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            type="button"
          >
            <Plus /> Dodaj wydarzenie
          </button>
        }
      />
      <div className="calendar-toolbar">
        <div className="calendar-tabs">
          <button
            className={mode === "month" ? "active" : ""}
            onClick={() => setMode("month")}
            type="button"
          >
            Miesiąc
          </button>
          <button
            className={mode === "upcoming" ? "active" : ""}
            onClick={() => setMode("upcoming")}
            type="button"
          >
            Nadchodzące
          </button>
        </div>
        {mode === "month" ? (
          <div className="calendar-month-nav">
            <button
              aria-label="Poprzedni miesiąc"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft />
            </button>
            <strong>
              {new Intl.DateTimeFormat("pl-PL", {
                month: "long",
                year: "numeric",
              }).format(cursor)}
            </strong>
            <button
              aria-label="Następny miesiąc"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight />
            </button>
          </div>
        ) : null}
      </div>
      {formOpen ? (
        <AppCard>
          <CalendarEventForm
            event={editing ?? undefined}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSubmit={async (input) => {
              if (editing) await update(editing.id, input);
              else await create(input);
              setFormOpen(false);
              setEditing(null);
            }}
          />
        </AppCard>
      ) : null}
      {error ? (
        <ErrorState
          description={error}
          onRetry={refresh}
          title="Kalendarz chwilowo się schował."
        />
      ) : null}
      {loading ? <LoadingState label="Zaglądamy do kalendarza…" /> : null}
      {!loading && mode === "month" ? (
        <AppCard className="month-card">
          <div className="month-weekdays">
            {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="month-grid">
            {cells.map((date, index) => {
              const key = date ? dateKey(date) : "",
                dayEvents = date ? eventsOnDay(key).slice(0, 3) : [];
              return (
                <div
                  className={
                    !date
                      ? "month-day month-day--empty"
                      : key === dateKey(today)
                        ? "month-day month-day--today"
                        : "month-day"
                  }
                  key={date?.toISOString() ?? `empty-${index}`}
                >
                  {date ? (
                    <>
                      <strong>{date.getDate()}</strong>
                      {dayEvents.map((event) => {
                        const start = eventKey(event),
                          end = eventEndKey(event),
                          position =
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
                            onClick={() => beginEdit(event)}
                            style={
                              {
                                "--event-color": eventColor(event),
                              } as React.CSSProperties
                            }
                            title={event.title}
                            type="button"
                          >
                            <span>
                              {position === "middle"
                                ? ""
                                : typeMeta(event).icon}
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
      ) : null}
      {!loading && mode === "upcoming" ? (
        <div className="upcoming-calendar">
          {events.length ? (
            Array.from(grouped.entries()).map(([key, values]) => (
              <section key={key}>
                <h2>{label(key)}</h2>
                <AppCard>
                  <ul>
                    {values.map((event) => (
                      <li key={event.id}>
                        <button
                          className="upcoming-event"
                          onClick={() => beginEdit(event)}
                          type="button"
                        >
                          <span className="upcoming-event__time">
                            {eventTime(event)}
                          </span>
                          <span className="upcoming-event__icon">
                            {typeMeta(event).icon}
                          </span>
                          <span>
                            <strong>{event.title}</strong>
                            <small>
                              {typeMeta(event).label}
                              {eventEndKey(event) !== eventKey(event)
                                ? ` · początek ${label(eventKey(event))}, koniec ${label(eventEndKey(event))}`
                                : ""}
                              {event.description
                                ? ` · ${event.description}`
                                : ""}
                            </small>
                          </span>
                        </button>
                        <div className="upcoming-event__actions">
                          {pendingDelete === event.id ? (
                            <button
                              className="ghost-button"
                              onClick={() => setPendingDelete(null)}
                            >
                              Anuluj
                            </button>
                          ) : null}
                          <button
                            className="ghost-button ghost-button--danger"
                            onClick={() =>
                              pendingDelete === event.id
                                ? void remove(event.id)
                                : setPendingDelete(event.id)
                            }
                          >
                            {pendingDelete === event.id ? "Usuń teraz" : "Usuń"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </AppCard>
              </section>
            ))
          ) : (
            <AppCard>
              <EmptyState
                title="Spokojnie w kalendarzu"
                description="Podejrzanie spokojnie."
              />
            </AppCard>
          )}
        </div>
      ) : null}
    </div>
  );
}
