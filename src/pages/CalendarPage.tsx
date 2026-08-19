import {
  CalendarSync,
  ChevronLeft,
  ChevronRight,
  Link2,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { CalendarEvent, CalendarSource } from "../../shared/models";
import { useAuth } from "../auth/AuthContext";
import { CalendarEventForm } from "../components/calendar/CalendarEventForm";
import { AppCard } from "../components/ui/AppCard";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { CALENDAR_COPY, CALENDAR_TYPES } from "../content/calendar";
import { useCalendar } from "../hooks/useCalendar";
import { useGoogleCalendarIntegration } from "../hooks/useGoogleCalendarIntegration";

const FILTER_STORAGE_KEY = "wariatkowo.calendar.enabled-sources";

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
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
  event.calendarColor ??
  EVENT_COLORS[
    Math.max(
      0,
      CALENDAR_TYPES.findIndex((item) => item.value === event.type),
    )
  ];

function storedFilters(sources: CalendarSource[]): Set<string> {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(FILTER_STORAGE_KEY) ?? "null",
    );
    if (Array.isArray(parsed)) {
      const available = new Set(sources.map((source) => source.id));
      return new Set(parsed.filter((id): id is string => available.has(id)));
    }
  } catch {
    // Fall back to Google's selected/visible state.
  }
  return new Set(
    sources
      .filter((source) => source.selected && !source.hidden)
      .map((source) => source.id),
  );
}

const callbackMessages: Record<string, string> = {
  connected: "Kalendarz Google został połączony i zsynchronizowany.",
  access_denied: "Anulowano łączenie Kalendarza Google.",
  invalid_state: "Sesja łączenia wygasła. Spróbuj ponownie.",
  missing_code: "Google nie zwrócił kodu autoryzacji.",
  wrong_account:
    "Wybrane konto Google nie jest kontem przypisanym do tego profilu.",
  offline_access_missing:
    "Google nie udostępnił dostępu offline. Połącz kalendarz ponownie.",
  missing_scopes:
    "Nie przyznano wszystkich wymaganych uprawnień Kalendarza Google.",
  oauth_failed: "Nie udało się połączyć Kalendarza Google.",
  sync_failed: "Konto połączono, ale pierwsza synchronizacja nie powiodła się.",
};

export function CalendarPage() {
  const location = useLocation();
  const { member } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [mode, setMode] = useState<"month" | "upcoming">("month");
  const [formOpen, setFormOpen] = useState(
    () => new URLSearchParams(location.search).get("add") === "1",
  );
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(
    null,
  );
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [enabledSources, setEnabledSources] = useState<Set<string> | null>(
    null,
  );

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const today = new Date();
  const from = mode === "month" ? dateKey(monthStart) : dateKey(today);
  const to =
    mode === "month"
      ? dateKey(monthEnd)
      : dateKey(
          new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()),
        );
  const { events, loading, error, refresh, create, update, remove } =
    useCalendar(from, to);
  const integration = useGoogleCalendarIntegration();

  useEffect(() => {
    if (integration.sources.length && enabledSources === null) {
      setEnabledSources(storedFilters(integration.sources));
    }
  }, [integration.sources, enabledSources]);

  const filteredEvents = useMemo(
    () =>
      enabledSources
        ? events.filter((event) => enabledSources.has(event.calendarSourceId))
        : events,
    [events, enabledSources],
  );
  const groupedSources = useMemo(() => {
    const groups = new Map<string, CalendarSource[]>();
    for (const source of integration.sources) {
      groups.set(source.ownerLabel, [
        ...(groups.get(source.ownerLabel) ?? []),
        source,
      ]);
    }
    return groups;
  }, [integration.sources]);
  const defaultSourceId = useMemo(() => {
    const writable = integration.sources.filter((source) => source.writable);
    return (
      writable.find(
        (source) =>
          source.primary && member && source.ownerNames.includes(member.name),
      )?.id ??
      writable.find((source) => source.kind === "google")?.id ??
      writable[0]?.id ??
      "local"
    );
  }, [integration.sources, member]);

  const cells = useMemo(() => {
    const result: Array<Date | null> = [];
    const offset = (monthStart.getDay() + 6) % 7;
    for (let index = 0; index < offset; index += 1) result.push(null);
    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      result.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    return result;
  }, [cursor.getFullYear(), cursor.getMonth()]);
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const key = eventKey(event);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [filteredEvents]);
  const eventsOnDay = (key: string) =>
    filteredEvents.filter(
      (event) => eventKey(event) <= key && eventEndKey(event) >= key,
    );
  const label = (key: string) => {
    const delta = Math.round(
      (Date.parse(`${key}T12:00:00`) -
        Date.parse(`${dateKey(today)}T12:00:00`)) /
        86400000,
    );
    if (delta === 0) return "Dzisiaj";
    if (delta === 1) return "Jutro";
    return new Intl.DateTimeFormat("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${key}T12:00:00`));
  };
  const toggleSource = (id: string) => {
    setEnabledSources((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };
  const deleteEvent = async (event: CalendarEvent) => {
    await remove(event.id);
    setPendingDelete(null);
    if (editing?.id === event.id) {
      setEditing(null);
      setFormOpen(false);
    }
  };
  const synchronize = async () => {
    await integration.synchronize();
    await refresh();
  };
  const callbackCode = new URLSearchParams(location.search).get(
    "googleCalendar",
  );

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

      {callbackCode && callbackMessages[callbackCode] ? (
        <p
          className={`calendar-callback-message ${
            callbackCode === "connected" ? "is-success" : "is-error"
          }`}
          role="status"
        >
          {callbackMessages[callbackCode]}
        </p>
      ) : null}

      <div className="calendar-settings-grid">
        <AppCard className="calendar-integration-card">
          <div className="calendar-card-heading">
            <div>
              <span className="calendar-card-eyebrow">Integracja</span>
              <h2>Google Calendar</h2>
            </div>
            <Link2 aria-hidden="true" />
          </div>
          {integration.loading ? (
            <p>Sprawdzanie połączenia…</p>
          ) : !integration.status ? (
            <p>Nie udało się odczytać stanu integracji.</p>
          ) : integration.status?.status === "disconnected" ? (
            <>
              <p>
                <strong>Niepołączony</strong>
              </p>
              <p>
                Połącz swoje konto, aby wyświetlać jego kalendarze w
                Wariatkowie.
              </p>
              <a
                className="primary-button calendar-connect-button"
                href="/api/integrations/google-calendar/connect"
              >
                Połącz Kalendarz Google
              </a>
            </>
          ) : (
            <>
              <p
                className={
                  integration.status?.connected
                    ? "connection-ok"
                    : "connection-warning"
                }
              >
                <strong>
                  {integration.status?.connected
                    ? "✓ Połączono"
                    : integration.status?.status === "needs_reconnect"
                      ? "Połączenie wygasło"
                      : "Błąd połączenia"}
                </strong>
                <br />
                {integration.status?.email}
              </p>
              <p>
                {integration.status?.calendarCount ?? 0} kalendarzy
                <br />
                Ostatnia synchronizacja:{" "}
                {integration.status?.lastSyncAt
                  ? new Intl.DateTimeFormat("pl-PL", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                    }).format(new Date(integration.status.lastSyncAt))
                  : "jeszcze nie wykonano"}
              </p>
              {integration.status?.message ? (
                <p className="form-message form-message--error">
                  {integration.status.message}
                </p>
              ) : null}
              <div className="calendar-integration-actions">
                {integration.status?.connected ? (
                  <button
                    className="secondary-button"
                    disabled={integration.working}
                    onClick={() => void synchronize()}
                    type="button"
                  >
                    <CalendarSync /> Synchronizuj
                  </button>
                ) : null}
                <a
                  className="secondary-button"
                  href="/api/integrations/google-calendar/connect"
                >
                  Połącz ponownie
                </a>
                {disconnectConfirm ? (
                  <button
                    className="ghost-button ghost-button--danger"
                    disabled={integration.working}
                    onClick={() =>
                      void integration.disconnect().then(() => {
                        setDisconnectConfirm(false);
                        void refresh();
                      })
                    }
                    type="button"
                  >
                    Potwierdź odłączenie
                  </button>
                ) : (
                  <button
                    className="ghost-button"
                    onClick={() => setDisconnectConfirm(true)}
                    type="button"
                  >
                    Odłącz
                  </button>
                )}
              </div>
            </>
          )}
          {integration.error ? (
            <p className="form-message form-message--error">
              {integration.error}
            </p>
          ) : null}
        </AppCard>

        <AppCard className="calendar-filter-card">
          <div className="calendar-card-heading">
            <div>
              <span className="calendar-card-eyebrow">Widok</span>
              <h2>Kalendarze</h2>
            </div>
          </div>
          {Array.from(groupedSources.entries()).map(([owner, sources]) => (
            <fieldset className="calendar-filter-group" key={owner}>
              <legend>{owner}</legend>
              {sources.map((source) => (
                <label key={source.id}>
                  <input
                    checked={enabledSources?.has(source.id) ?? source.selected}
                    onChange={() => toggleSource(source.id)}
                    type="checkbox"
                  />
                  <span
                    className="calendar-color-dot"
                    style={{
                      backgroundColor: source.backgroundColor ?? "#7c5caf",
                    }}
                  />
                  <span>{source.name}</span>
                  {source.syncError ? (
                    <small title={source.syncError}>⚠</small>
                  ) : null}
                </label>
              ))}
            </fieldset>
          ))}
        </AppCard>
      </div>

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
            defaultSourceId={defaultSourceId}
            event={editing ?? undefined}
            sources={integration.sources}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
              setPendingDelete(null);
            }}
            onSubmit={async (input) => {
              if (editing) await update(editing.id, input);
              else await create(input);
              setFormOpen(false);
              setEditing(null);
            }}
          />
          {editing?.canDelete ? (
            <div className="calendar-delete-panel">
              {pendingDelete?.id === editing.id ? (
                <>
                  <p>
                    Usunąć wydarzenie „{editing.title}”?
                    {editing.source === "google" ? (
                      <>
                        <br />
                        Wydarzenie zostanie również usunięte z Kalendarza
                        Google.
                      </>
                    ) : null}
                  </p>
                  <button
                    className="ghost-button"
                    onClick={() => setPendingDelete(null)}
                    type="button"
                  >
                    Anuluj
                  </button>
                  <button
                    className="ghost-button ghost-button--danger"
                    onClick={() => void deleteEvent(editing)}
                    type="button"
                  >
                    Usuń
                  </button>
                </>
              ) : (
                <button
                  className="ghost-button ghost-button--danger"
                  onClick={() => setPendingDelete(editing)}
                  type="button"
                >
                  Usuń wydarzenie
                </button>
              )}
            </div>
          ) : null}
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
              const key = date ? dateKey(date) : "";
              const dayEvents = date ? eventsOnDay(key).slice(0, 3) : [];
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
                        const start = eventKey(event);
                        const end = eventEndKey(event);
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
                            onClick={() => {
                              setEditing(event);
                              setFormOpen(true);
                            }}
                            style={
                              {
                                "--event-color": eventColor(event),
                              } as React.CSSProperties
                            }
                            title={`${event.title} · ${event.sourceOwnerName} · ${event.calendarName}`}
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
          {filteredEvents.length ? (
            Array.from(grouped.entries()).map(([key, values]) => (
              <section key={key}>
                <h2>{label(key)}</h2>
                <AppCard>
                  <ul>
                    {values.map((event) => (
                      <li key={event.id}>
                        <button
                          className="upcoming-event"
                          onClick={() => {
                            setEditing(event);
                            setFormOpen(true);
                          }}
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
                              {event.sourceOwnerName} · {event.calendarName}
                              {event.location ? ` · ${event.location}` : ""}
                              {eventEndKey(event) !== eventKey(event)
                                ? ` · początek ${label(eventKey(event))}, koniec ${label(eventEndKey(event))}`
                                : ""}
                            </small>
                          </span>
                        </button>
                        {event.canDelete ? (
                          <div className="upcoming-event__actions">
                            {pendingDelete?.id === event.id ? (
                              <>
                                <span className="calendar-delete-copy">
                                  {event.source === "google"
                                    ? "Usunie także z Google."
                                    : "Usunąć wydarzenie?"}
                                </span>
                                <button
                                  className="ghost-button"
                                  onClick={() => setPendingDelete(null)}
                                  type="button"
                                >
                                  Anuluj
                                </button>
                              </>
                            ) : null}
                            <button
                              className="ghost-button ghost-button--danger"
                              onClick={() =>
                                pendingDelete?.id === event.id
                                  ? void deleteEvent(event)
                                  : setPendingDelete(event)
                              }
                              type="button"
                            >
                              {pendingDelete?.id === event.id ? "Usuń" : "Usuń"}
                            </button>
                          </div>
                        ) : (
                          <small className="calendar-readonly-label">
                            Tylko do odczytu
                          </small>
                        )}
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
