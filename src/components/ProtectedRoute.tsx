import { Navigate, useLocation } from "react-router-dom";
import { LoadingState } from "./ui/LoadingState";
import { useAuth } from "../auth/AuthContext";
import type { ReactElement } from "react";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { member, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading)
    return (
      <main className="auth-loading">
        <LoadingState label="Sprawdzamy, kto wrócił do Wariatkowa…" />
      </main>
    );
  if (!member)
    return (
      <Navigate replace state={{ from: location.pathname }} to="/logowanie" />
    );
  return children;
}
