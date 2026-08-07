import { useCallback, useEffect, useRef, useState } from 'react';

export function useRouteExitTransition(onComplete: () => void, duration = 420): {
  isExiting: boolean;
  beginExit: () => void;
} {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const beginExit = useCallback(() => {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    timerRef.current = window.setTimeout(() => {
      onComplete();
    }, duration);
  }, [duration, isExiting, onComplete]);

  return { isExiting, beginExit };
}
