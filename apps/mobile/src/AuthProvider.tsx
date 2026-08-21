import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { HouseholdMember } from "../../../shared/models";
import { createApiClient } from "@wariatkowo/api-client";
import { sessionStore } from "./session";
import { clearWidget, configureWidget } from "./widgetBridge";
WebBrowser.maybeCompleteAuthSession();
export const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || "").replace(/\/$/, "");
type Auth = { member: HouseholdMember | null; loading: boolean; api: ReturnType<typeof createApiClient>; login(): Promise<void>; logout(): Promise<void> };
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [member, setMember] = useState<HouseholdMember | null>(null), [loading, setLoading] = useState(true);
  const api = useMemo(() => createApiClient({ baseUrl: apiBaseUrl, tokenStore: sessionStore, onUnauthorized: () => { void sessionStore.clear(); setMember(null); } }), []);
  const restore = useCallback(async () => { try { setMember(await api.auth.session()); } catch { setMember(null); } finally { setLoading(false); } }, [api]);
  useEffect(() => { void restore(); }, [restore]);
  const login = useCallback(async () => {
    const redirect = Linking.createURL("auth/callback");
    const result = await WebBrowser.openAuthSessionAsync(`${apiBaseUrl}/api/auth/mobile?redirect_uri=${encodeURIComponent(redirect)}`, redirect);
    if (result.type !== "success") return;
    const code = new URL(result.url).searchParams.get("code");
    if (!code) throw new Error("Logowanie nie zwróciło kodu sesji.");
    const exchanged = await api.auth.exchange(code); await sessionStore.set(exchanged.token); await configureWidget(apiBaseUrl, exchanged.token); setMember(exchanged.member);
  }, [api]);
  const logout = useCallback(async () => { try { await api.auth.logout(); } finally { await sessionStore.clear(); await clearWidget(); setMember(null); } }, [api]);
  return <Context.Provider value={{ member, loading, api, login, logout }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error("AuthProvider missing"); return value; }
