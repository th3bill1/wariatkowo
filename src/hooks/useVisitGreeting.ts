import { useEffect, useMemo, useState } from 'react';
import { pickGreeting } from '../content/greetings';
import { STORAGE_KEYS } from '../content/storageKeys';
import { readStorageValue, writeStorageValue } from '../utils/storage';

export type VisitorProfile = {
  firstSeenAt: number;
  lastSeenAt: number;
  visitCount: number;
  name?: string;
};

function readProfile(): VisitorProfile | null {
  const rawProfile = readStorageValue(STORAGE_KEYS.visitorProfile);
  if (!rawProfile) {
    return null;
  }

  try {
    return JSON.parse(rawProfile) as VisitorProfile;
  } catch {
    return null;
  }
}

export function useVisitGreeting(options: { recordVisit?: boolean } = {}): {
  greeting: string;
  isReturning: boolean;
  profile: VisitorProfile | null;
} {
  const recordVisit = options.recordVisit ?? true;
  const [profile, setProfile] = useState<VisitorProfile | null>(() => readProfile());

  useEffect(() => {
    const now = Date.now();
    const existingProfile = readProfile();
    const nextProfile: VisitorProfile = existingProfile
      ? {
          ...existingProfile,
          lastSeenAt: now,
          visitCount: existingProfile.visitCount + 1,
        }
      : {
          firstSeenAt: now,
          lastSeenAt: now,
          visitCount: 1,
        };

    if (recordVisit) {
      writeStorageValue(STORAGE_KEYS.visitorProfile, JSON.stringify(nextProfile));
      writeStorageValue(STORAGE_KEYS.hasVisited, 'true');
    }
    setProfile(nextProfile);
  }, [recordVisit]);

  const greeting = useMemo(() => {
    const now = new Date();
    return pickGreeting({
      isReturning: Boolean(profile && profile.visitCount > 1),
      hour: now.getHours(),
    });
  }, [profile]);

  return {
    greeting,
    isReturning: Boolean(profile && profile.visitCount > 1),
    profile,
  };
}
