import type { MobileReleaseStatus } from "./models";

export function hasNewerAndroidRelease(
  installedVersionCode: string | number | null | undefined,
  latest: MobileReleaseStatus,
): latest is Extract<MobileReleaseStatus, { available: true }> {
  const installed =
    typeof installedVersionCode === "number"
      ? installedVersionCode
      : Number(installedVersionCode);
  return (
    latest.available &&
    Number.isSafeInteger(installed) &&
    installed >= 1 &&
    latest.versionCode > installed
  );
}
