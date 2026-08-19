import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AppWordmark } from "../components/app/AppWordmark";

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  access_denied: "Logowanie przez Google zostało anulowane.",
  invalid_state: "Sesja logowania wygasła. Spróbuj jeszcze raz.",
  missing_code: "Google nie przekazał danych potrzebnych do logowania.",
  invalid_identity: "Google nie potwierdził adresu e-mail tego konta.",
  not_allowed: "To konto Google nie ma dostępu do Wariatkowa.",
  oauth_failed: "Nie udało się zalogować przez Google. Spróbuj ponownie.",
  auth_failed: "Nie udało się połączyć konta z Wariatkowem.",
};

export function LoginPage() {
  const { member, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const errorCode = searchParams.get("authError") ?? "";
  const error = errorCode
    ? (ERROR_MESSAGES[errorCode] ??
      "Nie udało się zalogować. Spróbuj ponownie.")
    : null;

  if (!isLoading && member) return <Navigate replace to="/dashboard" />;

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <AppWordmark />
        <div>
          <p className="page-header__eyebrow">Domowy dostęp</p>
          <h1 id="login-title">Wracamy do Wariatkowa?</h1>
          <p className="login-card__description">Zaloguj się przez Google.</p>
        </div>
        {error ? (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        ) : null}
        <a className="google-login-button" href="/api/auth/google">
          <span aria-hidden="true" className="google-login-button__mark">
            G
          </span>
          Zaloguj przez Google
        </a>
        <p className="login-card__note">Dostęp mają wyłącznie konta miśków.</p>
      </section>
    </main>
  );
}
