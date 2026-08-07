import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { CoffeeIcon, HeartIcon, HouseIcon, PawIcon, PizzaIcon, PlantIcon, SuitcaseIcon } from './DoodleIcons';
import type { DoodlePlacement } from '../content/doodles';
import { RANDOM_EVENT_COPY } from '../content/randomEvents';

const ICONS = {
  coffee: CoffeeIcon,
  plant: PlantIcon,
  paw: PawIcon,
  pizza: PizzaIcon,
  house: HouseIcon,
  heart: HeartIcon,
  suitcase: SuitcaseIcon,
} as const;

type DoodleProps = {
  placement: DoodlePlacement;
  parallaxEnabled: boolean;
  reducedMotion: boolean;
  totalChaos: boolean;
  onDogClick: () => void;
};

export function Doodle({
  placement,
  parallaxEnabled,
  reducedMotion,
  totalChaos,
  onDogClick,
}: DoodleProps) {
  const [isReacting, setIsReacting] = useState(false);

  const iconName = placement.visual.kind === 'svg' ? placement.visual.icon : null;
  const IconComponent = iconName ? ICONS[iconName] : null;
  const isInteractive = Boolean(placement.interactive);

  useEffect(() => {
    if (!isInteractive || !isReacting) {
      return;
    }

    const timer = window.setTimeout(() => setIsReacting(false), 1100);
    return () => window.clearTimeout(timer);
  }, [isInteractive, isReacting]);

  const style = {
    '--doodle-x': `${placement.x}%`,
    '--doodle-y': `${placement.y}%`,
    '--doodle-mobile-x': `${placement.mobileX ?? placement.x}%`,
    '--doodle-mobile-y': `${placement.mobileY ?? placement.y}%`,
    '--doodle-size': `${placement.size}px`,
    '--doodle-rotate': `${placement.rotate}deg`,
    '--doodle-depth': `${placement.depth}`,
  } as CSSProperties;

  const className = [
    'doodle',
    `doodle--${placement.id}`,
    parallaxEnabled ? 'doodle--parallax' : '',
    reducedMotion ? 'doodle--reduced-motion' : '',
    totalChaos ? 'doodle--chaos' : '',
    isInteractive ? 'doodle--interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  let content: JSX.Element | null = null;

  if (placement.visual.kind === 'image') {
    content = <img alt={placement.visual.alt} className="doodle__image" loading="lazy" src={placement.visual.src} />;
  } else if (IconComponent) {
    content = <IconComponent className="doodle__icon" />;
  }

  if (isInteractive) {
    return (
      <button
        aria-label={placement.title}
        className={className}
        onClick={() => {
          setIsReacting(true);
          onDogClick();
        }}
        style={style}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div aria-hidden="true" className={className} style={style}>
      {content}
    </div>
  );
}
