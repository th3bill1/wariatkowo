export { WIDGET_DEVICES } from "../../../shared/design";
export function normalizeDeviceName(value: string): string {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function findWidgetLightId(
  lights: Array<{ id: string; name: string }>,
  route: string,
): string | null {
  return (
    lights.find(
      (light) =>
        normalizeDeviceName(light.name) === route ||
        normalizeDeviceName(light.id) === route,
    )?.id ?? null
  );
}
