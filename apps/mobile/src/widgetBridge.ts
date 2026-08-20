import { NativeModules, Platform } from "react-native";
type WidgetModule = { configure(baseUrl: string, token: string): Promise<void>; refresh(): Promise<void>; clear(): Promise<void> };
const widget = NativeModules.WariatkowoWidget as WidgetModule | undefined;
export async function configureWidget(baseUrl: string, token: string) { if (Platform.OS === "android" && widget) await widget.configure(baseUrl, token); }
export async function clearWidget() { if (Platform.OS === "android" && widget) await widget.clear(); }
