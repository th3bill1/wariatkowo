import { useEffect, useRef } from 'react';

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

type UseKonamiCodeOptions = {
  enabled: boolean;
  onActivate: () => void;
};

export function useKonamiCode({ enabled, onActivate }: UseKonamiCodeOptions): void {
  const sequenceIndex = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const expected = KONAMI_SEQUENCE[sequenceIndex.current];
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

      if (key === expected) {
        sequenceIndex.current += 1;
        if (sequenceIndex.current === KONAMI_SEQUENCE.length) {
          sequenceIndex.current = 0;
          onActivate();
        }
        return;
      }

      sequenceIndex.current = key === KONAMI_SEQUENCE[0] ? 1 : 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onActivate]);
}
