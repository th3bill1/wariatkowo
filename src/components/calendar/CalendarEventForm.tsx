import { useState, type FormEvent } from "react";
import type {
  CalendarEvent,
  CalendarSource,
  CreateCalendarEventInput,
} from "../../../shared/models";
import { CALENDAR_TYPES } from "../../content/calendar";

const localDate = (value: string) => value.slice(0, 10);
const localDateTime = (value: string) => {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function CalendarEventForm({
  event,
  sources,
  defaultSourceId,
  onCancel,
  onSubmit,
}: {
  event?: CalendarEvent;
  sources: CalendarSource[];
  defaultSourceId: string;
  onCancel: () => void;
  onSubmit: (input: CreateCalendarEventInput) => Promise<unknown>;
}) {
  const readOnly = Boolean(event && !event.canEdit);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [type, setType] = useState(event?.type ?? "event");
  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [sourceId, setSourceId] = useState(
    event?.calendarSourceId ?? defaultSourceId,
  );
  const [start, setStart] = useState(
    event
      ? event.allDay
        ? localDate(event.startDate)
        : localDateTime(event.startDate)
      : new Date().toISOString().slice(0, 10),
  );
  const [end, setEnd] = useState(
    event?.endDate
      ? event.allDay
        ? localDate(event.endDate)
        : localDateTime(event.endDate)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title,
        description: description.trim() || null,
        type,
        startDate: allDay ? start : new Date(start).toISOString(),
        endDate: end ? (allDay ? end : new Date(end).toISOString()) : null,
        allDay,
        calendarSourceId: event ? event.calendarSourceId : sourceId,
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się zapisać wydarzenia.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="calendar-form" onSubmit={submit}>
      {readOnly ? (
        <p className="calendar-form__notice calendar-form__wide">
          To wydarzenie jest tylko do odczytu w Kalendarzu Google.
        </p>
      ) : null}
      {event?.recurring ? (
        <p className="calendar-form__notice calendar-form__wide">
          To wystąpienie wydarzenia cyklicznego. Edycja serii w Wariatkowie jest
          wyłączona, aby nie uszkodzić reguły powtarzania.
        </p>
      ) : null}
      <label className="field calendar-form__wide">
        <span className="field__label">Nazwa *</span>
        <input
          autoFocus={!readOnly}
          className="field__input"
          disabled={readOnly}
          maxLength={180}
          required
          value={title}
          onChange={(changeEvent) => setTitle(changeEvent.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Kalendarz</span>
        <select
          className="field__input"
          disabled={Boolean(event) || readOnly}
          value={sourceId}
          onChange={(changeEvent) => setSourceId(changeEvent.target.value)}
        >
          {event ? (
            <option value={event.calendarSourceId}>
              {event.sourceOwnerName} · {event.calendarName}
            </option>
          ) : (
            sources
              .filter((source) => source.writable)
              .map((source) => (
                <option key={source.id} value={source.id}>
                  {source.ownerLabel} · {source.name}
                </option>
              ))
          )}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Typ</span>
        <select
          className="field__input"
          disabled={readOnly}
          value={type}
          onChange={(changeEvent) =>
            setType(changeEvent.target.value as typeof type)
          }
        >
          {CALENDAR_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.icon} {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="calendar-form__check">
        <input
          checked={allDay}
          disabled={readOnly}
          onChange={(changeEvent) => {
            setAllDay(changeEvent.target.checked);
            setStart(new Date().toISOString().slice(0, 10));
            setEnd("");
          }}
          type="checkbox"
        />{" "}
        Cały dzień
      </label>
      <label className="field">
        <span className="field__label">
          {allDay ? "Data" : "Data i godzina"}
        </span>
        <input
          className="field__input"
          disabled={readOnly}
          required
          type={allDay ? "date" : "datetime-local"}
          value={start}
          onChange={(changeEvent) => setStart(changeEvent.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Do kiedy (opcjonalnie)</span>
        <input
          className="field__input"
          disabled={readOnly}
          type={allDay ? "date" : "datetime-local"}
          value={end}
          onChange={(changeEvent) => setEnd(changeEvent.target.value)}
        />
      </label>
      <label className="field calendar-form__wide">
        <span className="field__label">Opis</span>
        <textarea
          className="field__input"
          disabled={readOnly}
          maxLength={1500}
          rows={3}
          value={description}
          onChange={(changeEvent) => setDescription(changeEvent.target.value)}
        />
      </label>
      {event?.location ? (
        <p className="calendar-event-detail calendar-form__wide">
          <strong>Miejsce:</strong> {event.location}
        </p>
      ) : null}
      {event?.organizer ? (
        <p className="calendar-event-detail calendar-form__wide">
          <strong>Organizator:</strong>{" "}
          {event.organizer.displayName ?? event.organizer.email}
        </p>
      ) : null}
      {event?.attendees.length ? (
        <p className="calendar-event-detail calendar-form__wide">
          <strong>Goście:</strong>{" "}
          {event.attendees
            .map(
              (attendee) =>
                `${attendee.displayName ?? attendee.email ?? "Gość"}${
                  attendee.responseStatus ? ` (${attendee.responseStatus})` : ""
                }`,
            )
            .join(", ")}
        </p>
      ) : null}
      {event?.hangoutLink || event?.htmlLink ? (
        <div className="calendar-event-links calendar-form__wide">
          {event.hangoutLink ? (
            <a href={event.hangoutLink} rel="noreferrer" target="_blank">
              Dołącz do spotkania Google Meet
            </a>
          ) : null}
          {event.htmlLink ? (
            <a href={event.htmlLink} rel="noreferrer" target="_blank">
              Otwórz w Kalendarzu Google
            </a>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="form-message form-message--error calendar-form__wide">
          {error}
        </p>
      ) : null}
      <div className="shopping-form__actions calendar-form__wide">
        {!readOnly ? (
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Zapisywanie…" : "Zapisz wydarzenie"}
          </button>
        ) : null}
        <button
          className="secondary-button"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          {readOnly ? "Zamknij" : "Anuluj"}
        </button>
      </div>
    </form>
  );
}
