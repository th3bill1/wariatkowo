export function DeviceState({
  state,
  available,
}: {
  state: string;
  available: boolean;
}) {
  const label = !available
    ? "Niedostępne"
    : state === "on"
      ? "Włączone"
      : state === "off"
        ? "Wyłączone"
        : state;
  const stateClass = !available
    ? "home-device-state--offline"
    : state === "off"
      ? "home-device-state--off"
      : "";
  return (
    <span className={`home-device-state ${stateClass}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}
