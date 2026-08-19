import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CalendarSource,
  GoogleCalendarConnectionStatus,
} from "../../shared/models";
import { calendarService } from "../services/calendarService";

export function useGoogleCalendarIntegration() {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [status, setStatus] = useState<GoogleCalendarConnectionStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [nextSources, nextStatus] = await Promise.all([
        calendarService.sources(),
        calendarService.connectionStatus(),
      ]);
      setSources(nextSources);
      setStatus(nextStatus);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się pobrać ustawień kalendarzy.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  const synchronize = useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      const result = await calendarService.synchronize();
      await load();
      if (result.errors) {
        setError("Nie wszystkie kalendarze udało się zsynchronizować.");
      }
      return result;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się zsynchronizować kalendarzy.",
      );
      return { synchronized: 0, errors: 1 };
    } finally {
      setWorking(false);
    }
  }, [load]);

  const disconnect = useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      await calendarService.disconnectGoogle();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się odłączyć Kalendarza Google.",
      );
    } finally {
      setWorking(false);
    }
  }, [load]);

  return useMemo(
    () => ({
      sources,
      status,
      loading,
      working,
      error,
      refresh: load,
      synchronize,
      disconnect,
    }),
    [sources, status, loading, working, error, load, synchronize, disconnect],
  );
}
