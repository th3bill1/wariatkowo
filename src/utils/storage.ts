type StorageArea = "local" | "session";

function getStorage(area: StorageArea): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function readStorageValue(
  key: string,
  area: StorageArea = "local",
): string | null {
  const storage = getStorage(area);
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageValue(
  key: string,
  value: string,
  area: StorageArea = "local",
): void {
  const storage = getStorage(area);
  if (!storage) {
    return;
  }

  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}

export function removeStorageValue(
  key: string,
  area: StorageArea = "local",
): void {
  const storage = getStorage(area);
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}
