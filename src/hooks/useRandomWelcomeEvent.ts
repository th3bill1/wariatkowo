import { useEffect, useState } from "react";
import {
  RANDOM_EVENT_DEFINITIONS,
  type RandomEventId,
} from "../content/randomEvents";
import { STORAGE_KEYS } from "../content/storageKeys";
import { readStorageValue, writeStorageValue } from "../utils/storage";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

function pickRandomEvent(): RandomEventId | null {
  const roll = Math.random();
  let cursor = 0;

  for (const definition of RANDOM_EVENT_DEFINITIONS) {
    cursor += definition.chance;
    if (roll < cursor) {
      return definition.id;
    }
  }

  return null;
}

export function useRandomWelcomeEvent(): RandomEventId | null {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [eventId, setEventId] = useState<RandomEventId | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const existingEvent = readStorageValue(
      STORAGE_KEYS.sessionEvent,
      "session",
    );
    if (existingEvent) {
      setEventId(
        existingEvent === "none" ? null : (existingEvent as RandomEventId),
      );
      return;
    }

    const nextEvent = pickRandomEvent();
    writeStorageValue(
      STORAGE_KEYS.sessionEvent,
      nextEvent ?? "none",
      "session",
    );
    setEventId(nextEvent);
  }, [prefersReducedMotion]);

  return eventId;
}
