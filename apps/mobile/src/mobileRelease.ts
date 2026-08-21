import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { sessionStore } from "./session";

const APK_CONTENT_TYPE = "application/vnd.android.package-archive";

export async function downloadAndInstallAndroidRelease(
  baseUrl: string,
): Promise<void> {
  const token = await sessionStore.get();
  if (!token) throw new Error("Zaloguj się ponownie, aby pobrać aktualizację.");
  if (!FileSystem.cacheDirectory) {
    throw new Error("Pamięć podręczna aplikacji jest niedostępna.");
  }

  const destination = `${FileSystem.cacheDirectory}wariatkowo-update-${Date.now()}.apk`;
  const downloaded = await FileSystem.downloadAsync(
    `${baseUrl.replace(/\/$/, "")}/api/mobile/download`,
    destination,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (downloaded.status !== 200) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
    throw new Error("Nie udało się pobrać aktualizacji.");
  }

  const contentUri = await FileSystem.getContentUriAsync(destination);
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: contentUri,
    type: APK_CONTENT_TYPE,
    flags: 1,
  });
}
