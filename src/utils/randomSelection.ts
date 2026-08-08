export function randomUniqueItems<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [pool[index], pool[target]] = [pool[target], pool[index]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

export function randomRotation(random: () => number = Math.random): number {
  return Number((-6 + random() * 12).toFixed(2));
}
