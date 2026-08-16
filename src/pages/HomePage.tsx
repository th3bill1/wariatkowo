import { Sparkles } from "lucide-react";
import { AppCard } from "../components/ui/AppCard";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/SectionHeader";
import { ClimateCard } from "../components/home/ClimateCard";
import { LightCard } from "../components/home/LightCard";
import { MediaCard } from "../components/home/MediaCard";
import { useHomeStatus } from "../hooks/useHomeStatus";
import { homeService } from "../services/homeService";
import { useState } from "react";

export function HomePage() {
  const { status, loading, error, refresh } = useHomeStatus();
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    setActionError(null);
    try {
      await action();
      await refresh(true);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "Nie udało się wykonać operacji.",
      );
    } finally {
      setPending(false);
    }
  };

  const configured = status
    ? status.lights.length +
      Number(Boolean(status.ac)) +
      Number(Boolean(status.tv)) +
      Number(Boolean(status.xbox))
    : 0;
  return (
    <div className="content-stack home-page">
      <PageHeader
        eyebrow="Wariatkowo pod kontrolą"
        title="Dom"
        description="Światła, klima i wieczorne rozrywki — wszystko w jednym miejscu."
      />
      {loading && !status ? (
        <LoadingState label="Sprawdzamy, co słychać w domu…" />
      ) : null}
      {status && !status.connected ? (
        <div className="home-connection home-connection--offline" role="status">
          <strong>Home Assistant jest chwilowo niedostępny.</strong>
          <span>
            {status.message ?? "Spróbujemy ponownie za kilka sekund."}
          </span>
        </div>
      ) : status ? (
        <div className="home-connection">
          <span aria-hidden="true" />
          <strong>Dom jest połączony</strong>
        </div>
      ) : null}
      {error ? (
        <p className="form-message form-message--error" role="alert">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p className="form-message form-message--error" role="alert">
          {actionError}
        </p>
      ) : null}
      {status?.scenes.length ? (
        <AppCard className="home-scenes">
          <SectionHeader
            title="Domowe tryby"
            description="Jedno kliknięcie, kilka rzeczy dzieje się naraz."
          />
          <div className="home-scenes__actions">
            {status.scenes.map((scene) => (
              <button
                className="primary-button"
                disabled={pending || !status.connected}
                key={scene.id}
                onClick={() =>
                  void run(() => homeService.activateScene(scene.id))
                }
                type="button"
              >
                <Sparkles aria-hidden="true" /> {scene.name}
              </button>
            ))}
          </div>
        </AppCard>
      ) : null}
      {status?.lights.length ? (
        <section>
          <SectionHeader
            title="Światła"
            description="Ciepło, jasno albo kolorowo."
          />
          <div className="home-device-grid">
            {status.lights.map((light) => (
              <LightCard
                busy={pending}
                key={light.id}
                light={light}
                run={run}
              />
            ))}
          </div>
        </section>
      ) : null}
      {status?.ac ? (
        <section>
          <SectionHeader title="Klimatyzacja" />
          <div className="home-device-grid">
            <ClimateCard busy={pending} climate={status.ac} run={run} />
          </div>
        </section>
      ) : null}
      {status?.tv || status?.xbox ? (
        <section>
          <SectionHeader
            title="Rozrywka"
            description="Telewizor i Xbox bez szukania pilotów."
          />
          <div className="home-device-grid">
            {status.tv ? (
              <MediaCard busy={pending} device={status.tv} run={run} />
            ) : null}
            {status.xbox ? (
              <MediaCard busy={pending} device={status.xbox} run={run} />
            ) : null}
          </div>
        </section>
      ) : null}
      {status && !configured ? (
        <AppCard>
          <SectionHeader
            title="Dom czeka na konfigurację"
            description="Dodaj encje Home Assistant w pliku .env na serwerze."
          />
        </AppCard>
      ) : null}
    </div>
  );
}
