import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent, RefObject } from "react";

export function usePointerParallax<T extends HTMLElement>(
  enabled: boolean,
): {
  containerRef: RefObject<T>;
  handlePointerMove: (event: PointerEvent<T>) => void;
  handlePointerLeave: () => void;
} {
  const containerRef = useRef<T | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastEventRef = useRef<PointerEvent<T> | null>(null);

  const updateVariables = useCallback(() => {
    frameRef.current = null;

    const container = containerRef.current;
    const event = lastEventRef.current;
    if (!container || !event) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    container.style.setProperty("--parallax-x", `${x.toFixed(3)}`);
    container.style.setProperty("--parallax-y", `${y.toFixed(3)}`);
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent<T>) => {
      if (!enabled) {
        return;
      }

      lastEventRef.current = event;
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(updateVariables);
    },
    [enabled, updateVariables],
  );

  const handlePointerLeave = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.style.setProperty("--parallax-x", "0");
    container.style.setProperty("--parallax-y", "0");
    lastEventRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    containerRef: containerRef as RefObject<T>,
    handlePointerMove,
    handlePointerLeave,
  };
}
