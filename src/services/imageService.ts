const POLAROID_URL = /^\/media\/polaroids\/[^/?#]+\.(?:jpe?g|png|webp)$/i;

export async function fetchPolaroidUrls(
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const response = await fetch("/api/images/polaroids", { signal });
    if (!response.ok) return [];

    const payload: unknown = await response.json();
    return Array.isArray(payload)
      ? payload.filter(
          (value): value is string =>
            typeof value === "string" && POLAROID_URL.test(value),
        )
      : [];
  } catch {
    return [];
  }
}
