import { useState, type FormEvent } from "react";
import type {
  CalendarEvent,
  CreateCalendarEventInput,
} from "../../../shared/models";
import { CALENDAR_TYPES } from "../../content/calendar";
const localDate = (value: string) => value.slice(0, 10);
const localDateTime = (value: string) => {
  const date = new Date(value),
    offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
export function CalendarEventForm({
  event,
  onCancel,
  onSubmit,
}: {
  event?: CalendarEvent;
  onCancel: () => void;
  onSubmit: (input: CreateCalendarEventInput) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(event?.title ?? ""),
    [description, setDescription] = useState(event?.description ?? ""),
    [type, setType] = useState(event?.type ?? "event"),
    [allDay, setAllDay] = useState(event?.allDay ?? true);
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
    ),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
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
      <label className="field calendar-form__wide">
        <span className="field__label">Nazwa *</span>
        <input
          autoFocus
          className="field__input"
          maxLength={180}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Typ</span>
        <select
          className="field__input"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
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
          onChange={(e) => {
            setAllDay(e.target.checked);
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
          required
          type={allDay ? "date" : "datetime-local"}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Do kiedy (opcjonalnie)</span>
        <input
          className="field__input"
          type={allDay ? "date" : "datetime-local"}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <label className="field calendar-form__wide">
        <span className="field__label">Opis</span>
        <textarea
          className="field__input"
          maxLength={1500}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error ? (
        <p className="form-message form-message--error calendar-form__wide">
          {error}
        </p>
      ) : null}
      <div className="shopping-form__actions calendar-form__wide">
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? "Zapisywanie…" : "Zapisz wydarzenie"}
        </button>
        <button
          className="secondary-button"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
