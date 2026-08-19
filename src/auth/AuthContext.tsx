import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HouseholdMember } from "../../shared/models";
import { requestJson } from "../services/http";

type AuthContextValue = {
  member: HouseholdMember | null;
  isLoading: boolean;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<HouseholdMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    void requestJson<HouseholdMember | null>("/api/auth/session")
      .then(setMember)
      .finally(() => setIsLoading(false));
  }, []);
  const logout = useCallback(async () => {
    await requestJson("/api/auth/logout", { method: "POST" });
    setMember(null);
  }, []);
  const value = useMemo(
    () => ({
      member,
      isLoading,
      logout,
    }),
    [member, isLoading, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
