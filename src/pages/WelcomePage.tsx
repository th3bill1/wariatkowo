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

function pickRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function WelcomePage() {
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
