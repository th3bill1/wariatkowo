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
import { CalendarMonthView } from "../components/calendar/CalendarMonthView";
import { CalendarUpcomingView } from "../components/calendar/CalendarUpcomingView";
import { AppCard } from "../components/ui/AppCard";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { CALENDAR_COPY } from "../content/calendar";
import { useCalendar } from "../hooks/useCalendar";
import { useGoogleCalendarIntegration } from "../hooks/useGoogleCalendarIntegration";
import { calendarDateKey } from "../utils/calendarView";

const FILTER_STORAGE_KEY = "wariatkowo.calendar.enabled-sources";

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
  const from =
    mode === "month" ? calendarDateKey(monthStart) : calendarDateKey(today);
  const to =
    mode === "month"
      ? calendarDateKey(monthEnd)
      : calendarDateKey(
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
        <CalendarMonthView
          cursor={cursor}
          events={filteredEvents}
          onSelect={(event) => {
            setEditing(event);
            setFormOpen(true);
          }}
          today={today}
        />
      ) : null}

      {!loading && mode === "upcoming" ? (
        <CalendarUpcomingView
          events={filteredEvents}
          onCancelDelete={() => setPendingDelete(null)}
          onConfirmDelete={(event) => void deleteEvent(event)}
          onRequestDelete={setPendingDelete}
          onSelect={(event) => {
            setEditing(event);
            setFormOpen(true);
          }}
          pendingDelete={pendingDelete}
          today={today}
        />
      ) : null}
    </div>
  );
}
