import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { FloatingDoodles } from "../components/FloatingDoodles";
import { RandomEventLayer } from "../components/RandomEventLayer";
import { WelcomeCTA } from "../components/WelcomeCTA";
import { WelcomeGreeting } from "../components/WelcomeGreeting";
import { WariatkowoLogo } from "../components/WariatkowoLogo";
import { WariatkowoStatus } from "../components/WariatkowoStatus";
import { WARIATKOWO_STATUSES } from "../content/statuses";
import { WARIATKOWO_SUBTITLES } from "../content/subtitles";
import { RANDOM_EVENT_COPY, type RandomEventId } from "../content/randomEvents";
import { useDesktopOnly } from "../hooks/useDesktopOnly";
import { useKonamiCode } from "../hooks/useKonamiCode";
import { useRandomWelcomeEvent } from "../hooks/useRandomWelcomeEvent";
import { useRouteExitTransition } from "../hooks/useRouteExitTransition";
import { useVisitGreeting } from "../hooks/useVisitGreeting";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

function pickRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function WelcomePage() {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const isDesktop = useDesktopOnly();
  const greetingState = useVisitGreeting();
  const randomEventId = useRandomWelcomeEvent();
  const [visibleEventId, setVisibleEventId] = useState<RandomEventId | null>(
    randomEventId,
  );
  const [subtitle] = useState(() => pickRandomItem(WARIATKOWO_SUBTITLES));
  const [statusText] = useState(() => pickRandomItem(WARIATKOWO_STATUSES));
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

  const status = useMemo(() => {
    if (visibleEventId === "suspiciousStatus") {
      return RANDOM_EVENT_COPY.suspiciousStatus;
    }

    return statusText;
  }, [statusText, visibleEventId]);

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
      <FloatingDoodles totalChaos={totalChaos} />

      <section className="welcome-page__content" aria-label="Wariatkowo">
        <WariatkowoLogo
          malfunctioning={logoMalfunctioning}
          onActivateChaosMode={handleActivateChaosMode}
          totalChaos={totalChaos}
        />

        <WelcomeGreeting
          greeting={greetingState.greeting}
          subtitle={subtitle}
        />

        <p className="welcome-page__microcopy">Domowy panel miśkowy.</p>

        <WelcomeCTA isExiting={isExiting} onClick={beginExit} />

        <WariatkowoStatus status={status} />

        <div className="welcome-page__footnote" aria-hidden="true">
          <span>Super mieszkanie.</span>
          <span>Pyszne jedzenie.</span>
          <span>Duuużo miłości.</span>
        </div>
      </section>
    </main>
  );
}
