export const SHOPPING_CATEGORIES = [
  "Warzywa i owoce",
  "Pieczywo",
  "Nabiał",
  "Białko",
  "Napoje",
  "Chemia",
  "Dom",
  "Inne",
] as const;

export function normalizeProductName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/\s+/g, " ");
}

export function groupByShoppingCategory<T extends { category: string | null }>(
  items: T[],
  categories: readonly string[],
): Array<[string, T[]]> {
  const grouped = new Map<string, T[]>();
  for (const category of categories) grouped.set(category, []);
  if (!grouped.has("Inne")) grouped.set("Inne", []);
  for (const item of items) {
    const category =
      item.category && grouped.has(item.category) ? item.category : "Inne";
    grouped.get(category)?.push(item);
  }
  return Array.from(grouped.entries()).filter(
    ([, values]) => values.length > 0,
  );
}
