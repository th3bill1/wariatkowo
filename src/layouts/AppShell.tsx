import { LogOut, RefreshCw } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AppWordmark } from "../components/app/AppWordmark";
import { ProfileAvatar } from "../components/app/ProfileAvatar";
import { Icon } from "../components/ui/Icon";
import { APP_NAV_ITEMS } from "../content/appShell";

export function AppShell() {
  const { member, logout } = useAuth();
  const navigate = useNavigate();
  const leave = async (changeAccount: boolean) => {
    await logout();
    navigate(changeAccount ? "/logowanie" : "/", { replace: true });
  };
  const profileControls = (
    <div className="app-shell__profile">
      {member ? <ProfileAvatar member={member} /> : null}
      <div className="app-shell__profile-copy">
        <strong>{member?.name}</strong>
        <span>W Wariatkowie</span>
      </div>
      <button
        aria-label="Zmień konto Google"
        className="icon-button"
        onClick={() => void leave(true)}
        title="Zmień konto Google"
        type="button"
      >
        <RefreshCw />
      </button>
      <button
        aria-label="Wyloguj"
        className="icon-button"
        onClick={() => void leave(false)}
        title="Wyloguj"
        type="button"
      >
        <LogOut />
      </button>
    </div>
  );
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <AppWordmark />
        {profileControls}
        <nav className="app-shell__nav" aria-label="Nawigacja Wariatkowa">
          {APP_NAV_ITEMS.map((item) => (
            <NavLink
              className={({ isActive }) =>
                [
                  "app-shell__nav-link",
                  isActive ? "app-shell__nav-link--active" : "",
                ].join(" ")
              }
              key={item.webPath}
              to={item.webPath}
            >
              <Icon className="app-shell__nav-icon" name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-shell__content">
        <header className="app-shell__mobile-bar">
          <AppWordmark compact />
          {profileControls}
        </header>
        <main className="app-shell__page">
          <Outlet />
        </main>
      </div>
      <nav
        className="app-shell__bottom-nav"
        aria-label="Nawigacja dolna Wariatkowa"
      >
        {APP_NAV_ITEMS.map((item) => (
          <NavLink
            className={({ isActive }) =>
              [
                "app-shell__bottom-link",
                isActive ? "app-shell__bottom-link--active" : "",
              ].join(" ")
            }
            key={item.webPath}
            to={item.webPath}
          >
            <Icon className="app-shell__nav-icon" name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
