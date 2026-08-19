import type { CalendarEvent } from "../../../shared/models";
import {
  eventEndDateKey,
  eventStartDateKey,
  eventTimeLabel,
  eventTypeMeta,
  groupEventsByStartDate,
  relativeDateLabel,
} from "../../utils/calendarView";
import { AppCard } from "../ui/AppCard";
import { EmptyState } from "../ui/EmptyState";

type CalendarUpcomingViewProps = {
  events: CalendarEvent[];
  onCancelDelete: () => void;
  onConfirmDelete: (event: CalendarEvent) => void;
  onRequestDelete: (event: CalendarEvent) => void;
  onSelect: (event: CalendarEvent) => void;
  pendingDelete: CalendarEvent | null;
  today: Date;
};

export function CalendarUpcomingView({
  events,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  onSelect,
  pendingDelete,
  today,
}: CalendarUpcomingViewProps) {
  if (!events.length) {
    return (
      <div className="upcoming-calendar">
        <AppCard>
          <EmptyState
            title="Spokojnie w kalendarzu"
            description="Podejrzanie spokojnie."
          />
        </AppCard>
      </div>
    );
  }

  return (
    <div className="upcoming-calendar">
      {Array.from(groupEventsByStartDate(events).entries()).map(
        ([key, values]) => (
          <section key={key}>
            <h2>{relativeDateLabel(key, today)}</h2>
            <AppCard>
              <ul>
                {values.map((event) => {
                  const deletePending = pendingDelete?.id === event.id;
                  return (
                    <li key={event.id}>
                      <button
                        className="upcoming-event"
                        onClick={() => onSelect(event)}
                        type="button"
                      >
                        <span className="upcoming-event__time">
                          {eventTimeLabel(event)}
                        </span>
                        <span className="upcoming-event__icon">
                          {eventTypeMeta(event).icon}
                        </span>
                        <span>
                          <strong>{event.title}</strong>
                          <small>
                            {event.sourceOwnerName} · {event.calendarName}
                            {event.location ? ` · ${event.location}` : ""}
                            {eventEndDateKey(event) !== eventStartDateKey(event)
                              ? ` · początek ${relativeDateLabel(eventStartDateKey(event), today)}, koniec ${relativeDateLabel(eventEndDateKey(event), today)}`
                              : ""}
                          </small>
                        </span>
                      </button>
                      {event.canDelete ? (
                        <div className="upcoming-event__actions">
                          {deletePending ? (
                            <>
                              <span className="calendar-delete-copy">
                                {event.source === "google"
                                  ? "Usunie także z Google."
                                  : "Usunąć wydarzenie?"}
                              </span>
                              <button
                                className="ghost-button"
                                onClick={onCancelDelete}
                                type="button"
                              >
                                Anuluj
                              </button>
                            </>
                          ) : null}
                          <button
                            className="ghost-button ghost-button--danger"
                            onClick={() =>
                              deletePending
                                ? onConfirmDelete(event)
                                : onRequestDelete(event)
                            }
                            type="button"
                          >
                            Usuń
                          </button>
                        </div>
                      ) : (
                        <small className="calendar-readonly-label">
                          Tylko do odczytu
                        </small>
                      )}
                    </li>
                  );
                })}
              </ul>
            </AppCard>
          </section>
        ),
      )}
    </div>
  );
}
