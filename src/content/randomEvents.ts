export type RandomEventId =
  | 'fallingHeart'
  | 'logoMalfunction'
  | 'suspiciousStatus';

export type RandomEventDefinition = {
  id: RandomEventId;
  label: string;
  chance: number;
};

export const RANDOM_EVENT_DEFINITIONS: readonly RandomEventDefinition[] = [
  {
    id: 'fallingHeart',
    label: 'Spadające serce',
    chance: 0.04,
  },
  {
    id: 'logoMalfunction',
    label: 'Awaria logo',
    chance: 0.035,
  },
  {
    id: 'suspiciousStatus',
    label: 'Podejrzany status',
    chance: 0.05,
  },
];

export const RANDOM_EVENT_COPY = {
  suspiciousStatus: 'Brak poważnych awarii. Podejrzane.',
  dogBubble: 'HAU!',
  totalChaos: 'Tryb Totalnego Wariata',
  konami: 'Niespodziewany poziom chaosu odblokowany.',
} as const;
