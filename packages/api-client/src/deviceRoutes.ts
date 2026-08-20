export const WIDGET_DEVICES = [
  { route: "boskie-swiatlo", label: "Boskie światło", kind: "light" },
  { route: "miskolampa", label: "Miśkolampa", kind: "light" },
  { route: "szumownica", label: "Szumownica", kind: "ac" },
] as const;
export function normalizeDeviceName(value: string): string { return value.toLocaleLowerCase("pl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
export function findWidgetLightId(lights: Array<{ id: string; name: string }>, route: string): string | null {
  return lights.find((light) => normalizeDeviceName(light.name) === route || normalizeDeviceName(light.id) === route)?.id ?? null;
}
