import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { WelcomePolaroids } from "../components/WelcomePolaroids";
import { RandomEventLayer } from "../components/RandomEventLayer";
import { WelcomeCTA } from "../components/WelcomeCTA";
import { WariatkowoLogo } from "../components/WariatkowoLogo";
import { type RandomEventId } from "../content/randomEvents";
import { WARIATKOWO_SUBTITLES } from "../content/subtitles";
import { useDesktopOnly } from "../hooks/useDesktopOnly";
import { useKonamiCode } from "../hooks/useKonamiCode";
import { useRandomWelcomeEvent } from "../hooks/useRandomWelcomeEvent";
import { useRouteExitTransition } from "../hooks/useRouteExitTransition";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const REVEAL_AT = new Date("2026-08-13T15:00:00+02:00").getTime();
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type CountdownValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
};

function pickRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function getCountdownValue(now: number): CountdownValue {
  const totalMilliseconds = Math.max(0, REVEAL_AT - now);

  return {
    days: Math.floor(totalMilliseconds / DAY),
    hours: Math.floor((totalMilliseconds % DAY) / HOUR),
    minutes: Math.floor((totalMilliseconds % HOUR) / MINUTE),
    seconds: Math.floor((totalMilliseconds % MINUTE) / SECOND),
    totalMilliseconds,
  };
}

function CountdownUnit({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span className="welcome-countdown__unit">
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{label}</span>
    </span>
  );
}

function WelcomeCountdownPage({ countdown }: { countdown: CountdownValue }) {
  return (
    <main className="welcome-page welcome-page--countdown">
      <AnimatedBackground totalChaos={false} />
      <WelcomePolaroids totalChaos={false} />

      <section
        className="welcome-countdown"
        aria-label="Wielki powrót Miśki"
      >
        <p className="welcome-countdown__eyebrow">13 sierpnia 2026, 15:00</p>
        <h1>wielki powrót miśki</h1>
        <div className="welcome-countdown__grid">
          <CountdownUnit label="dni" value={countdown.days} />
          <CountdownUnit label="godziny" value={countdown.hours} />
          <CountdownUnit label="minuty" value={countdown.minutes} />
          <CountdownUnit label="sekundy" value={countdown.seconds} />
        </div>
      </section>
    </main>
  );
}

function RevealedWelcomePage() {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const isDesktop = useDesktopOnly();
  const randomEventId = useRandomWelcomeEvent();
  const [visibleEventId, setVisibleEventId] = useState<RandomEventId | null>(
    randomEventId,
  );
  const [subtitle] = useState(() => pickRandomItem(WARIATKOWO_SUBTITLES));
  const [isTotalChaos, setIsTotalChaos] = useState(false);
  const [isKonamiChaos, setIsKonamiChaos] = useState(false);
  const [logoMalfunctioning, setLogoMalfunctioning] = useState(false);
  const chaosTimerRef = useRef<number | null>(null);
  const konamiTimerRef = useRef<number | null>(null);

  const { isExiting, beginExit } = useRouteExitTransition(() =>
    navigate("/dashboard"),
  );

  useEffect(() => {
    setVisibleEventId(randomEventId);
  }, [randomEventId]);

  useKonamiCode({
    enabled: isDesktop && !reducedMotion,
    onActivate: () => {
      setIsKonamiChaos(true);
      if (konamiTimerRef.current !== null) {
        window.clearTimeout(konamiTimerRef.current);
      }

      konamiTimerRef.current = window.setTimeout(
        () => setIsKonamiChaos(false),
        6500,
      );
    },
  });

  useEffect(() => {
    return () => {
      if (chaosTimerRef.current !== null) {
        window.clearTimeout(chaosTimerRef.current);
      }

      if (konamiTimerRef.current !== null) {
        window.clearTimeout(konamiTimerRef.current);
      }
    };
  }, []);

  const handleActivateChaosMode = () => {
    setIsTotalChaos(true);

    if (chaosTimerRef.current !== null) {
      window.clearTimeout(chaosTimerRef.current);
    }

    chaosTimerRef.current = window.setTimeout(
      () => setIsTotalChaos(false),
      8500,
    );
  };

  const handleEventComplete = () => {
    setVisibleEventId(null);
    setLogoMalfunctioning(false);
  };

  const totalChaos = isTotalChaos || isKonamiChaos;

  return (
    <main
      className={[
        "welcome-page",
        isExiting ? "welcome-page--exiting" : "",
        totalChaos ? "welcome-page--chaos" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <AnimatedBackground totalChaos={totalChaos} />
      <RandomEventLayer
        eventId={visibleEventId}
        onComplete={handleEventComplete}
        onLogoMalfunctionChange={setLogoMalfunctioning}
      />
      <WelcomePolaroids totalChaos={totalChaos} />

      <section className="welcome-page__content" aria-label="Wariatkowo">
        <WariatkowoLogo
          malfunctioning={logoMalfunctioning}
          onActivateChaosMode={handleActivateChaosMode}
          totalChaos={totalChaos}
        />

        <p className="welcome-greeting__subtitle">{subtitle}</p>

        <WelcomeCTA isExiting={isExiting} onClick={beginExit} />

        <div className="welcome-page__footnote" aria-hidden="true">
          <span>Super mieszkanie.</span>
          <span>Pyszne jedzenie.</span>
          <span>Duuużo miłości.</span>
        </div>
      </section>
    </main>
  );
}

export function WelcomePage() {
  const [countdown, setCountdown] = useState(() =>
    getCountdownValue(Date.now()),
  );

  useEffect(() => {
    if (REVEAL_AT <= Date.now()) return;

    const timerId = window.setInterval(() => {
      const nextCountdown = getCountdownValue(Date.now());
      setCountdown(nextCountdown);

      if (nextCountdown.totalMilliseconds === 0) {
        window.clearInterval(timerId);
      }
    }, SECOND);

    return () => window.clearInterval(timerId);
  }, []);

  if (countdown.totalMilliseconds > 0) {
    return <WelcomeCountdownPage countdown={countdown} />;
  }

  return <RevealedWelcomePage />;
}
