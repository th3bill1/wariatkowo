import { NativeModules, Platform } from "react-native";

export type WidgetPinResult = {
  supported: boolean;
  requested: boolean;
  reason?: "unsupported_android" | "unsupported_launcher" | "request_rejected";
};

type WidgetModule = {
  configure(baseUrl: string, token: string): Promise<void>;
  requestPin(): Promise<WidgetPinResult>;
  refresh(): Promise<void>;
  clear(): Promise<void>;
};

const widget = NativeModules.WariatkowoWidget as WidgetModule | undefined;

export async function configureWidget(baseUrl: string, token: string) {
  if (Platform.OS === "android" && widget) {
    await widget.configure(baseUrl, token);
  }
}

export async function requestPinWidget(): Promise<WidgetPinResult> {
  if (Platform.OS !== "android" || !widget) {
    return {
      supported: false,
      requested: false,
      reason: "unsupported_android",
    };
  }
  return widget.requestPin();
}

export async function refreshWidget() {
  if (Platform.OS === "android" && widget) await widget.refresh();
}

export async function clearWidget() {
  if (Platform.OS === "android" && widget) await widget.clear();
}
