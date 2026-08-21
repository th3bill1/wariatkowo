import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams } from "expo-router";
import {
  CalendarSync,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CALENDAR_TYPES } from "../../../../shared/calendar";
import type {
  CalendarEvent,
  CalendarSource,
  CreateCalendarEventInput,
  GoogleCalendarConnectionStatus,
} from "../../../../shared/models";
import { apiBaseUrl, useAuth } from "../../src/AuthProvider";
import { cached } from "../../src/cache";
import { CalendarEventForm } from "../../src/CalendarEventForm";
import {
  dateKey,
  eventEndDateKey,
  eventTimeLabel,
  relativeDateLabel,
} from "../../src/date";
import { colors, fonts } from "../../src/theme";
import { useForegroundRefresh } from "../../src/useForegroundRefresh";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  SectionHeader,
  State,
  s,
} from "../../src/ui";

const FILTER_STORAGE_KEY = "wariatkowo.calendar.enabled-sources";
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

function eventStartKey(event: CalendarEvent) {
  return event.allDay ? event.startDate.slice(0, 10) : dateKey(event.startDate);
}

function colorForEvent(event: CalendarEvent) {
  if (event.calendarColor) return event.calendarColor;
  const index = CALENDAR_TYPES.findIndex((item) => item.value === event.type);
  return EVENT_COLORS[Math.max(0, index)];
}

function monthCells(cursor: Date): Array<Date | null> {
  const result: Array<Date | null> = [];
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  for (let index = 0; index < offset; index += 1) result.push(null);
  for (let day = 1; day <= last.getDate(); day += 1)
    result.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  while (result.length % 7) result.push(null);
  return result;
}

function eventsOnDate(events: CalendarEvent[], key: string) {
  return events.filter(
    (event) => eventStartKey(event) <= key && eventEndDateKey(event) >= key,
  );
}

function EventRow({
  event,
  onSelect,
  onDelete,
}: {
  event: CalendarEvent;
  onSelect(event: CalendarEvent): void;
  onDelete(event: CalendarEvent): void;
}) {
  const type =
    CALENDAR_TYPES.find((item) => item.value === event.type) ??
    CALENDAR_TYPES[0];
  const multiDay = eventEndDateKey(event) !== eventStartKey(event);
  return (
    <View style={styles.eventRow}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSelect(event)}
        style={({ pressed }) => [styles.eventMain, pressed && s.pressed]}
      >
        <Text style={styles.eventTime}>{eventTimeLabel(event)}</Text>
        <Text style={styles.eventIcon}>{type.icon}</Text>
        <View style={s.grow}>
          <Text style={s.label}>{event.title}</Text>
          <Text style={s.meta}>
            {event.sourceOwnerName} · {event.calendarName}
            {event.location ? ` · ${event.location}` : ""}
            {multiDay
              ? ` · do ${relativeDateLabel(eventEndDateKey(event))}`
              : ""}
          </Text>
          {!event.canEdit ? (
            <Text style={styles.readonly}>Tylko do odczytu</Text>
          ) : null}
        </View>
      </Pressable>
      {event.canDelete ? (
        <Pressable
          accessibilityLabel={`Usuń ${event.title}`}
          accessibilityRole="button"
          onPress={() => onDelete(event)}
          style={({ pressed }) => [styles.deleteButton, pressed && s.pressed]}
        >
          <Trash2 color={colors.textDanger} size={19} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function CalendarScreen() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const { api, member } = useAuth();
  const [cursor, setCursor] = useState(() => new Date());
  const [mode, setMode] = useState<"month" | "upcoming">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [connection, setConnection] =
    useState<GoogleCalendarConnectionStatus | null>(null);
  const [enabledSources, setEnabledSources] = useState<Set<string> | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const handledAdd = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (add && handledAdd.current !== add) {
      handledAdd.current = add;
      setEditing(null);
      setFormOpen(true);
    }
  }, [add]);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const today = new Date();
  const from = mode === "month" ? dateKey(monthStart) : dateKey(today);
  const upcomingEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 3,
    today.getDate(),
  );
  const to = mode === "month" ? dateKey(monthEnd) : dateKey(upcomingEnd);

  const loadEvents = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const result = await cached(`calendar:${from}:${to}`, () =>
          api.calendar.list(from, to),
        );
        setEvents(result.data);
        setError(
          result.stale
            ? "Tryb offline — kalendarz może być nieaktualny."
            : null,
        );
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Nie udało się pobrać kalendarza.",
        );
      } finally {
        setLoading(false);
      }
    },
    [api, from, to],
  );
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const [nextSources, status] = await Promise.all([
        api.calendar.sources(),
        api.calendar.googleStatus(),
      ]);
      setSources(nextSources);
      setConnection(status);
      setSettingsError(null);
      if (enabledSources === null) {
        const stored = await AsyncStorage.getItem(FILTER_STORAGE_KEY);
        let next: Set<string> | null = null;
        if (stored) {
          try {
            const values = JSON.parse(stored) as unknown;
            if (Array.isArray(values)) {
              const available = new Set(nextSources.map((source) => source.id));
              next = new Set(
                values.filter(
                  (value): value is string =>
                    typeof value === "string" && available.has(value),
                ),
              );
            }
          } catch {
            next = null;
          }
        }
        setEnabledSources(
          next ??
            new Set(
              nextSources
                .filter((source) => source.selected && !source.hidden)
                .map((source) => source.id),
            ),
        );
      }
    } catch (reason) {
      setSettingsError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się pobrać ustawień kalendarzy.",
      );
    } finally {
      setSettingsLoading(false);
    }
  }, [api, enabledSources]);
  useEffect(() => void loadEvents(), [loadEvents]);
  useEffect(() => void loadSettings(), [loadSettings]);
  useForegroundRefresh(() => {
    void loadEvents(false);
    void loadSettings();
  });

  const filtered = useMemo(
    () =>
      enabledSources
        ? events.filter((event) => enabledSources.has(event.calendarSourceId))
        : events,
    [enabledSources, events],
  );
  const defaultSourceId = useMemo(() => {
    const writable = sources.filter((source) => source.writable);
    return (
      writable.find(
        (source) =>
          source.primary && member && source.ownerNames.includes(member.name),
      )?.id ??
      writable.find((source) => source.kind === "google")?.id ??
      writable[0]?.id ??
      "local"
    );
  }, [member, sources]);
  const groups = useMemo(() => {
    const grouped = new Map<string, CalendarSource[]>();
    for (const source of sources)
      grouped.set(source.ownerLabel, [
        ...(grouped.get(source.ownerLabel) ?? []),
        source,
      ]);
    return grouped;
  }, [sources]);
  const groupedEvents = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of filtered) {
      const key = eventStartKey(event);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    }
    return grouped;
  }, [filtered]);
  const toggleSource = (id: string) => {
    setEnabledSources((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void AsyncStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };
  const openEvent = (event: CalendarEvent) => {
    setEditing(event);
    setFormOpen(true);
  };
  const deleteEvent = (event: CalendarEvent) => {
    Alert.alert(
      "Usunąć wydarzenie?",
      `${event.title}${event.source === "google" ? "\nWydarzenie zostanie również usunięte z Kalendarza Google." : ""}`,
      [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          style: "destructive",
          onPress: () =>
            void api.calendar
              .remove(event.id)
              .then(() => {
                setEvents((current) =>
                  current.filter((value) => value.id !== event.id),
                );
                if (editing?.id === event.id) {
                  setEditing(null);
                  setFormOpen(false);
                }
              })
              .catch((reason) => setError(reason.message)),
        },
      ],
    );
  };
  const synchronize = async () => {
    setWorking(true);
    setSettingsError(null);
    try {
      const result = await api.calendar.sync();
      if (result.errors)
        setSettingsError("Nie wszystkie kalendarze udało się zsynchronizować.");
      await Promise.all([loadSettings(), loadEvents(false)]);
    } catch (reason) {
      setSettingsError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się zsynchronizować kalendarzy.",
      );
    } finally {
      setWorking(false);
    }
  };
  const createOrUpdate = async (input: CreateCalendarEventInput) => {
    if (editing) {
      const updated = await api.calendar.update(editing.id, input);
      setEvents((current) =>
        current
          .map((event) => (event.id === editing.id ? updated : event))
          .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
    } else {
      const created = await api.calendar.create(input);
      setEvents((current) =>
        [...current, created].sort((a, b) =>
          a.startDate.localeCompare(b.startDate),
        ),
      );
    }
    setEditing(null);
    setFormOpen(false);
  };
  const setMonth = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
    setSelectedDate(dateKey(next));
  };
  const selectedEvents = eventsOnDate(filtered, selectedDate);

  return (
    <ScrollView
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={loading || settingsLoading}
          onRefresh={() => void Promise.all([loadEvents(), loadSettings()])}
          tintColor={colors.purple}
        />
      }
    >
      <PageHeader
        action={
          <Button
            Icon={Plus}
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            title="Dodaj wydarzenie"
          />
        }
        description="Wizyty, wyjazdy i wszystko, o czym lepiej pamiętać."
        eyebrow="Wspólne plany"
        title="Kalendarz Wariatkowa"
      />

      <Card>
        <View style={s.spaceBetween}>
          <View style={s.grow}>
            <Text style={s.eyebrow}>Integracja</Text>
            <Text style={s.sectionTitle}>Google Calendar</Text>
          </View>
          <Link2 color={colors.purple} size={24} />
        </View>
        {settingsLoading ? (
          <Text style={s.meta}>Sprawdzanie połączenia…</Text>
        ) : null}
        {connection?.status === "disconnected" ? (
          <>
            <Text style={s.label}>Niepołączony</Text>
            <Text style={s.body}>
              Połącz konto, aby wyświetlać jego kalendarze w Wariatkowie.
            </Text>
          </>
        ) : connection ? (
          <View style={{ gap: 5 }}>
            <Text style={connection.connected ? styles.connected : s.error}>
              {connection.connected
                ? "✓ Połączono"
                : connection.status === "needs_reconnect"
                  ? "Połączenie wygasło"
                  : "Błąd połączenia"}
            </Text>
            {connection.email ? (
              <Text style={s.body}>{connection.email}</Text>
            ) : null}
            <Text style={s.meta}>
              {connection.calendarCount} kalendarzy · ostatnia synchronizacja:{" "}
              {connection.lastSyncAt
                ? new Intl.DateTimeFormat("pl-PL", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                  }).format(new Date(connection.lastSyncAt))
                : "jeszcze nie wykonano"}
            </Text>
            {connection.message ? (
              <Text style={s.error}>{connection.message}</Text>
            ) : null}
          </View>
        ) : null}
        {settingsError ? <Text style={s.error}>{settingsError}</Text> : null}
        <View style={s.wrap}>
          {connection?.connected ? (
            <Button
              compact
              disabled={working}
              Icon={CalendarSync}
              onPress={() => void synchronize()}
              title={working ? "Synchronizacja…" : "Synchronizuj"}
              variant="secondary"
            />
          ) : null}
          <Button
            compact
            Icon={ExternalLink}
            onPress={() =>
              void WebBrowser.openBrowserAsync(`${apiBaseUrl}/kalendarz`)
            }
            title={
              connection?.connected
                ? "Zarządzaj w przeglądarce"
                : "Połącz w przeglądarce"
            }
            variant="ghost"
          />
          {connection && connection.status !== "disconnected" ? (
            <Button
              compact
              disabled={working}
              onPress={() =>
                Alert.alert(
                  "Odłączyć Kalendarz Google?",
                  "Kalendarze Google znikną z Wariatkowa.",
                  [
                    { text: "Anuluj", style: "cancel" },
                    {
                      text: "Odłącz",
                      style: "destructive",
                      onPress: () =>
                        void api.calendar
                          .disconnectGoogle()
                          .then(() =>
                            Promise.all([loadSettings(), loadEvents(false)]),
                          )
                          .catch((reason) => setSettingsError(reason.message)),
                    },
                  ],
                )
              }
              title="Odłącz"
              variant="danger"
            />
          ) : null}
        </View>
      </Card>

      {sources.length ? (
        <Card>
          <SectionHeader
            description="Wybierz kalendarze widoczne w obu widokach."
            title="Kalendarze"
          />
          {Array.from(groups.entries()).map(([owner, values]) => (
            <View key={owner} style={styles.sourceGroup}>
              <Text style={s.strongMeta}>{owner}</Text>
              {values.map((source) => {
                const selected =
                  enabledSources?.has(source.id) ?? source.selected;
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={source.id}
                    onPress={() => toggleSource(source.id)}
                    style={({ pressed }) => [
                      styles.source,
                      pressed && s.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.sourceCheck,
                        selected && styles.sourceCheckSelected,
                      ]}
                    >
                      {selected ? (
                        <Check color={colors.white} size={15} strokeWidth={3} />
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.colorDot,
                        {
                          backgroundColor: source.backgroundColor ?? "#7c5caf",
                        },
                      ]}
                    />
                    <Text style={[s.body, s.grow]}>{source.name}</Text>
                    {source.syncError ? <Text style={s.error}>⚠</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>
      ) : null}

      <View style={styles.toolbar}>
        <View style={s.chips}>
          <Chip
            label="Miesiąc"
            onPress={() => setMode("month")}
            selected={mode === "month"}
          />
          <Chip
            label="Nadchodzące"
            onPress={() => setMode("upcoming")}
            selected={mode === "upcoming"}
          />
        </View>
        {mode === "month" ? (
          <View style={styles.monthNav}>
            <Pressable
              accessibilityLabel="Poprzedni miesiąc"
              onPress={() => setMonth(-1)}
              style={styles.navButton}
            >
              <ChevronLeft color={colors.text} size={22} />
            </Pressable>
            <Text style={styles.monthName}>
              {new Intl.DateTimeFormat("pl-PL", {
                month: "long",
                year: "numeric",
              }).format(cursor)}
            </Text>
            <Pressable
              accessibilityLabel="Następny miesiąc"
              onPress={() => setMonth(1)}
              style={styles.navButton}
            >
              <ChevronRight color={colors.text} size={22} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {formOpen ? (
        <Card>
          <SectionHeader
            description={
              editing
                ? `${editing.sourceOwnerName} · ${editing.calendarName}`
                : "Wspólny lub połączony kalendarz."
            }
            title={editing ? editing.title : "Nowe wydarzenie"}
          />
          <CalendarEventForm
            key={editing?.id ?? "new"}
            defaultSourceId={defaultSourceId}
            event={editing ?? undefined}
            onCancel={() => {
              setFormOpen(false);
              setEditing(null);
            }}
            onSubmit={createOrUpdate}
            sources={sources}
          />
          {editing?.canDelete ? (
            <Button
              Icon={Trash2}
              onPress={() => deleteEvent(editing)}
              title="Usuń wydarzenie"
              variant="danger"
            />
          ) : null}
        </Card>
      ) : null}

      <State
        error={error}
        loading={loading}
        loadingLabel="Zaglądamy do kalendarza…"
        onRetry={() => void loadEvents()}
      />
      {!loading && mode === "month" ? (
        <Card>
          <View style={styles.weekdays}>
            {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].map((day) => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.monthGrid}>
            {monthCells(cursor).map((date, index) => {
              const key = date ? dateKey(date) : "";
              const dayEvents = date ? eventsOnDate(filtered, key) : [];
              const selected = key === selectedDate;
              const isToday = key === dateKey(today);
              return (
                <Pressable
                  accessibilityLabel={
                    date
                      ? `${date.getDate()}, ${dayEvents.length} wydarzeń`
                      : undefined
                  }
                  disabled={!date}
                  key={date?.toISOString() ?? `empty-${index}`}
                  onPress={() => setSelectedDate(key)}
                  style={[
                    styles.day,
                    selected && styles.daySelected,
                    isToday && styles.dayToday,
                  ]}
                >
                  {date ? (
                    <Text
                      style={[
                        styles.dayNumber,
                        selected && styles.dayNumberSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  ) : null}
                  <View style={styles.dots}>
                    {dayEvents.slice(0, 3).map((event) => (
                      <View
                        key={event.id}
                        style={[
                          styles.eventDot,
                          { backgroundColor: colorForEvent(event) },
                        ]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <SectionHeader
            description={relativeDateLabel(selectedDate)}
            title="Wydarzenia dnia"
          />
          {selectedEvents.length ? (
            selectedEvents.map((event) => (
              <EventRow
                event={event}
                key={event.id}
                onDelete={deleteEvent}
                onSelect={openEvent}
              />
            ))
          ) : (
            <EmptyState
              description="Wybierz inny dzień albo dodaj wydarzenie."
              title="Nic tego dnia"
            />
          )}
        </Card>
      ) : null}
      {!loading && mode === "upcoming" ? (
        <View style={{ gap: 14 }}>
          {!filtered.length ? (
            <Card>
              <EmptyState
                description="Podejrzanie spokojnie."
                title="Spokojnie w kalendarzu"
              />
            </Card>
          ) : null}
          {Array.from(groupedEvents.entries()).map(([key, values]) => (
            <View key={key} style={{ gap: 7 }}>
              <Text style={styles.dateHeading}>{relativeDateLabel(key)}</Text>
              <Card>
                {values.map((event) => (
                  <EventRow
                    event={event}
                    key={event.id}
                    onDelete={deleteEvent}
                    onSelect={openEvent}
                  />
                ))}
              </Card>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  connected: {
    color: colors.greenDark,
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  sourceGroup: { gap: 5, paddingTop: 4 },
  source: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 9 },
  sourceCheck: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceCheckSelected: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  colorDot: { width: 11, height: 11, borderRadius: 6 },
  toolbar: { gap: 10 },
  monthNav: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  monthName: {
    flex: 1,
    textAlign: "center",
    textTransform: "capitalize",
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 15,
  },
  weekdays: { flexDirection: "row" },
  weekday: {
    width: "14.2857%",
    textAlign: "center",
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  day: {
    width: "14.2857%",
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 12,
  },
  daySelected: { backgroundColor: colors.purple },
  dayToday: { borderWidth: 1, borderColor: colors.purple },
  dayNumber: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  dayNumberSelected: { color: colors.white },
  dots: { minHeight: 5, flexDirection: "row", gap: 2 },
  eventDot: { width: 5, height: 5, borderRadius: 3 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eventMain: {
    flex: 1,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
  },
  eventTime: {
    width: 61,
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  eventIcon: { fontSize: 19 },
  deleteButton: {
    width: 42,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  readonly: {
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 11,
    marginTop: 2,
  },
  dateHeading: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 20,
    textTransform: "capitalize",
  },
});
