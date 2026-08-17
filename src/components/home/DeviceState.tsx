export function DeviceState({
  state,
  available,
  label,
}: {
  state: string;
  available: boolean;
  label?: string;
}) {
  const displayedLabel = !available
    ? "Niedostępne"
    : (label ??
      (state === "on" ? "Włączone" : state === "off" ? "Wyłączone" : state));
  const stateClass = !available
    ? "home-device-state--offline"
    : state === "off"
      ? "home-device-state--off"
      : "";
  return (
    <span className={`home-device-state ${stateClass}`}>
      <span aria-hidden="true" />
      {displayedLabel}
    </span>
  );
}
