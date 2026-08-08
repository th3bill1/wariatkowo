export function formatPolishDateLabel(
  dateString: string | null,
): string | null {
  if (!dateString) {
    return null;
  }

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  const dueKey = new Date(dateString).toISOString().slice(0, 10);
  if (dueKey === todayKey) {
    return "Dzisiaj";
  }

  if (dueKey === tomorrowKey) {
    return "Jutro";
  }

  if (dueKey < todayKey) {
    return "Po terminie";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(dateString));
}
