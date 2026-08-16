import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeStatus } from "../../shared/models";
import { homeService } from "../services/homeService";

export function useHomeStatus(pollInterval = 4_000) {
  const [status, setStatus] = useState<HomeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback((force = false): Promise<void> => {
    if (inFlight.current && !force) return inFlight.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    const request = homeService
      .status(nextController.signal)
      .then((snapshot) => {
        if (!mounted.current) return;
        setStatus(snapshot);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!mounted.current || nextController.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Nie udało się odświeżyć stanu domu.",
        );
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
        if (inFlight.current === request) inFlight.current = null;
      });
    inFlight.current = request;
    return request;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollInterval);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      controller.current?.abort();
    };
  }, [pollInterval, refresh]);

  return { status, loading, error, refresh };
}
