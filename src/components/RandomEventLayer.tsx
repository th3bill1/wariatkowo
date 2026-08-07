import { useEffect, useMemo } from 'react';
import { HeartIcon } from './DoodleIcons';
import { RANDOM_EVENT_COPY, RANDOM_EVENT_DEFINITIONS, type RandomEventId } from '../content/randomEvents';

type RandomEventLayerProps = {
  eventId: RandomEventId | null;
  onComplete: () => void;
  onLogoMalfunctionChange: (isActive: boolean) => void;
};

function getEventLabel(eventId: RandomEventId): string {
  return RANDOM_EVENT_DEFINITIONS.find((definition) => definition.id === eventId)?.label ?? '';
}

function FallingHeartEvent({ onComplete, label }: { onComplete: () => void; label: string }) {
  const hearts = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => ({
        id: index,
        left: 12 + index * 13,
        delay: index * 0.35,
        size: 14 + (index % 3) * 4,
      })),
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(onComplete, 4200);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div aria-label={label} className="random-event random-event--hearts" role="status">
      <p className="random-event__label">{label}</p>
      <div className="random-event__hearts">
        {hearts.map((heart) => (
          <span
            aria-hidden="true"
            className="random-event__heart"
            key={heart.id}
            style={{
              left: `${heart.left}%`,
              animationDelay: `${heart.delay}s`,
              width: `${heart.size}px`,
              height: `${heart.size}px`,
            }}
          >
            <HeartIcon className="random-event__heart-icon" />
          </span>
        ))}
      </div>
    </div>
  );
}

function SuspiciousStatusEvent({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 4500);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div aria-label={RANDOM_EVENT_COPY.suspiciousStatus} className="random-event random-event--status" role="status">
      <p className="random-event__status-copy">{RANDOM_EVENT_COPY.suspiciousStatus}</p>
    </div>
  );
}

export function RandomEventLayer({ eventId, onComplete, onLogoMalfunctionChange }: RandomEventLayerProps) {
  const label = eventId ? getEventLabel(eventId) : '';

  useEffect(() => {
    if (!eventId) {
      return;
    }

    if (eventId === 'logoMalfunction') {
      onLogoMalfunctionChange(true);
      const timer = window.setTimeout(() => {
        onLogoMalfunctionChange(false);
        onComplete();
      }, 4200);

      return () => {
        window.clearTimeout(timer);
        onLogoMalfunctionChange(false);
      };
    }

    return undefined;
  }, [eventId, onComplete, onLogoMalfunctionChange]);

  if (!eventId) {
    return null;
  }

  if (eventId === 'fallingHeart') {
    return <FallingHeartEvent label={label} onComplete={onComplete} />;
  }

  if (eventId === 'suspiciousStatus') {
    return <SuspiciousStatusEvent onComplete={onComplete} />;
  }

  return (
    <div aria-hidden="true" className="random-event random-event--logo" />
  );
}
