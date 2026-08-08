import { useEffect, useMemo, useRef, useState } from "react";
import { WELCOME_COPY } from "../content/welcome";

type WariatkowoLogoProps = {
  totalChaos: boolean;
  malfunctioning: boolean;
  onActivateChaosMode: () => void;
};

const LETTER_STYLES = [
  { rotate: -6, shiftY: 2, scale: 1.02 },
  { rotate: 3, shiftY: -1, scale: 0.98 },
  { rotate: -2, shiftY: 1, scale: 1.01 },
  { rotate: 4, shiftY: 0, scale: 0.99 },
  { rotate: -4, shiftY: 2, scale: 1 },
  { rotate: 2, shiftY: -2, scale: 1.03 },
  { rotate: -3, shiftY: 1, scale: 0.98 },
  { rotate: 4, shiftY: 0, scale: 1.01 },
  { rotate: -2, shiftY: -1, scale: 1 },
  { rotate: 5, shiftY: 1, scale: 0.99 },
] as const;

export function WariatkowoLogo({
  totalChaos,
  malfunctioning,
  onActivateChaosMode,
}: WariatkowoLogoProps) {
  const [clickCount, setClickCount] = useState(0);
  const resetTimerRef = useRef<number | null>(null);

  const letters = useMemo(() => WELCOME_COPY.logo.split(""), []);

  useEffect(() => {
    if (clickCount < 5) {
      return;
    }

    onActivateChaosMode();
    setClickCount(0);
  }, [clickCount, onActivateChaosMode]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  return (
    <button
      aria-label={WELCOME_COPY.logo}
      className={[
        "wariatkowo-logo",
        totalChaos ? "wariatkowo-logo--chaos" : "",
        malfunctioning ? "wariatkowo-logo--malfunctioning" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => setClickCount((value) => value + 1)}
      type="button"
    >
      {letters.map((letter, index) => {
        const style = LETTER_STYLES[index];
        return (
          <span
            aria-hidden="true"
            className="wariatkowo-logo__letter"
            key={`${letter}-${index}`}
            style={
              {
                "--letter-rotate": `${style.rotate}deg`,
                "--letter-shift-y": `${style.shiftY}px`,
                "--letter-scale": `${style.scale}`,
              } as React.CSSProperties
            }
          >
            {letter}
          </span>
        );
      })}
    </button>
  );
}
