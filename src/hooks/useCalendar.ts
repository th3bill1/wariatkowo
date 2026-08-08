import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "../../shared/models";
import { calendarService } from "../services/calendarService";
export function useCalendar(from: string, to: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setError(null);
      setEvents(await calendarService.list(from, to));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się pobrać kalendarza.",
      );
    } finally {
      setLoading(false);
    }
  }, [from, to]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => void load(),
      visible = () => {
        if (document.visibilityState === "visible") refresh();
      };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  const create = useCallback(async (input: CreateCalendarEventInput) => {
    const value = await calendarService.create(input);
    setEvents((current) =>
      [...current, value].sort((a, b) =>
        a.startDate.localeCompare(b.startDate),
      ),
    );
    return value;
  }, []);
  const update = useCallback(
    async (id: string, input: UpdateCalendarEventInput) => {
      const value = await calendarService.update(id, input);
      setEvents((current) =>
        current
          .map((event) => (event.id === id ? value : event))
          .sort((a, b) => a.startDate.localeCompare(b.startDate)),
      );
      return value;
    },
    [],
  );
  const remove = useCallback(async (id: string) => {
    await calendarService.remove(id);
    setEvents((current) => current.filter((event) => event.id !== id));
  }, []);
  return useMemo(
    () => ({ events, loading, error, refresh: load, create, update, remove }),
    [events, loading, error, load, create, update, remove],
  );
}
