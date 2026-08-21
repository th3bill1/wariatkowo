import type { TaskAssignment, TaskRecurrence } from "./models";

export const TASK_ASSIGNMENT_LABELS: Record<TaskAssignment, string> = {
  anyone: "Dla kogokolwiek",
  misiek: "Misiek",
  miska: "Miśka",
  both: "Dla nas",
};

export function taskRecurrenceLabel(
  rule: TaskRecurrence | null,
): string | null {
  if (!rule) return null;
  if (rule.unit === "day" && rule.interval === 1) return "Codziennie";
  if (rule.unit === "week" && rule.interval === 1) return "Co tydzień";
  if (rule.unit === "week" && rule.interval === 2) return "Co 2 tygodnie";
  if (rule.unit === "month" && rule.interval === 1) return "Co miesiąc";
  return `Co ${rule.interval} dni`;
}

export const HOME_OPTION_LABELS: Record<string, string> = {
  off: "Wyłączony",
  fan_only: "Nawiew",
  heat: "Grzanie",
  cool: "Chłodzenie",
  dry: "Osuszanie",
  auto: "Automatyczny",
  low: "Niski",
  middle_low: "Średnio niski",
  medium: "Średni",
  middle_high: "Średnio wysoki",
  high: "Wysoki",
  swing: "Wachlowanie",
  top: "Góra",
  mid_high: "Średnio wysoko",
  mid_low: "Średnio nisko",
  bottom: "Dół",
  both_sides: "Obie strony",
  left: "Lewo",
  forward: "Na wprost",
  right: "Prawo",
  general: "Ogólny",
  for_old: "Dla seniora",
  for_young: "Dla dorosłych",
  for_kid: "Dla dziecka",
};

export function homeOptionLabel(value: string): string {
  return HOME_OPTION_LABELS[value] ?? value.replaceAll("_", " ");
}
