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
  return (
    <span
      className={`home-device-state ${available ? "" : "home-device-state--offline"}`}
    >
      <span aria-hidden="true" />
      {label}
    </span>
  );
}
