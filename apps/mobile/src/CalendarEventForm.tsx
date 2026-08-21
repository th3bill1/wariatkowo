import * as Linking from "expo-linking";
import { useState } from "react";
import { Text, View } from "react-native";
import { CALENDAR_TYPES } from "../../../shared/calendar";
import type {
  CalendarEvent,
  CalendarEventType,
  CalendarSource,
  CreateCalendarEventInput,
} from "../../../shared/models";
import { dateKey, localDateTimeValue } from "./date";
import { DateField, SelectField, SwitchField } from "./formControls";
import { Button, Field, s } from "./ui";

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
  onCancel(): void;
  onSubmit(input: CreateCalendarEventInput): Promise<unknown>;
}) {
  const readOnly = Boolean(event && !event.canEdit);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [type, setType] = useState<CalendarEventType>(event?.type ?? "event");
  const [allDay, setAllDay] = useState(event?.allDay ?? true);
  const [sourceId, setSourceId] = useState(
    event?.calendarSourceId ?? defaultSourceId,
  );
  const [start, setStart] = useState(
    event
      ? event.allDay
        ? event.startDate.slice(0, 10)
        : localDateTimeValue(event.startDate)
      : dateKey(new Date()),
  );
  const [end, setEnd] = useState(
    event?.endDate
      ? event.allDay
        ? event.endDate.slice(0, 10)
        : localDateTimeValue(event.endDate)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (readOnly) return;
    if (!title.trim() || !start) {
      setError("Podaj nazwę i datę wydarzenia.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
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
    <View style={{ gap: 12 }}>
      {readOnly ? (
        <Text style={s.meta}>
          To wydarzenie jest tylko do odczytu w Kalendarzu Google.
        </Text>
      ) : null}
      {event?.recurring ? (
        <Text style={s.meta}>
          To wystąpienie wydarzenia cyklicznego. Edycja serii jest wyłączona,
          aby nie uszkodzić reguły powtarzania.
        </Text>
      ) : null}
      <Field
        editable={!readOnly}
        label="Nazwa *"
        maxLength={180}
        onChangeText={setTitle}
        value={title}
      />
      <SelectField
        enabled={!event && !readOnly}
        label="Kalendarz"
        onChange={setSourceId}
        options={
          event
            ? [
                {
                  value: event.calendarSourceId,
                  label: `${event.sourceOwnerName} · ${event.calendarName}`,
                },
              ]
            : sources
                .filter((source) => source.writable)
                .map((source) => ({
                  value: source.id,
                  label: `${source.ownerLabel} · ${source.name}`,
                }))
        }
        value={sourceId}
      />
      <SelectField<CalendarEventType>
        enabled={!readOnly}
        label="Typ"
        onChange={setType}
        options={CALENDAR_TYPES.map((item) => ({
          value: item.value,
          label: `${item.icon} ${item.label}`,
        }))}
        value={type}
      />
      <SwitchField
        enabled={!readOnly}
        label="Cały dzień"
        onChange={(value) => {
          setAllDay(value);
          setStart(
            value ? dateKey(new Date()) : localDateTimeValue(new Date()),
          );
          setEnd("");
        }}
        value={allDay}
      />
      <DateField
        allowClear={false}
        enabled={!readOnly}
        includeTime={!allDay}
        label={allDay ? "Data" : "Data i godzina"}
        onChange={setStart}
        value={start}
      />
      <DateField
        enabled={!readOnly}
        includeTime={!allDay}
        label="Do kiedy (opcjonalnie)"
        onChange={setEnd}
        value={end}
      />
      <Field
        editable={!readOnly}
        label="Opis"
        maxLength={1500}
        multiline
        onChangeText={setDescription}
        value={description}
      />
      {event?.location ? (
        <Text style={s.body}>
          <Text style={s.strongMeta}>Miejsce: </Text>
          {event.location}
        </Text>
      ) : null}
      {event?.organizer ? (
        <Text style={s.body}>
          <Text style={s.strongMeta}>Organizator: </Text>
          {event.organizer.displayName ?? event.organizer.email}
        </Text>
      ) : null}
      {event?.attendees.length ? (
        <Text style={s.body}>
          <Text style={s.strongMeta}>Goście: </Text>
          {event.attendees
            .map(
              (attendee) =>
                `${attendee.displayName ?? attendee.email ?? "Gość"}${attendee.responseStatus ? ` (${attendee.responseStatus})` : ""}`,
            )
            .join(", ")}
        </Text>
      ) : null}
      {event?.hangoutLink ? (
        <Button
          onPress={() => void Linking.openURL(event.hangoutLink!)}
          title="Dołącz do Google Meet"
          variant="secondary"
        />
      ) : null}
      {event?.htmlLink ? (
        <Button
          onPress={() => void Linking.openURL(event.htmlLink!)}
          title="Otwórz w Kalendarzu Google"
          variant="ghost"
        />
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
      <View style={s.wrap}>
        {!readOnly ? (
          <Button
            disabled={saving}
            onPress={() => void submit()}
            title={saving ? "Zapisywanie…" : "Zapisz wydarzenie"}
          />
        ) : null}
        <Button
          disabled={saving}
          onPress={onCancel}
          title={readOnly ? "Zamknij" : "Anuluj"}
          variant="ghost"
        />
      </View>
    </View>
  );
}
