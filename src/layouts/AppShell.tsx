import { NavLink, Outlet } from 'react-router-dom';
import { APP_NAV_ITEMS, APP_SHELL_COPY } from '../content/appShell';
import { Icon } from '../components/ui/Icon';
import { AppWordmark } from '../components/app/AppWordmark';

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <AppWordmark />
        <nav className="app-shell__nav" aria-label="Nawigacja Wariatkowa">
          {APP_NAV_ITEMS.map((item) => (
            <NavLink
              className={({ isActive }) => ['app-shell__nav-link', isActive ? 'app-shell__nav-link--active' : ''].join(' ')}
              key={item.path}
              to={item.path}
            >
              <Icon className="app-shell__nav-icon" name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <p className="app-shell__aside-note">{APP_SHELL_COPY.moreSections}</p>
      </aside>

      <div className="app-shell__content">
        <header className="app-shell__mobile-bar">
          <AppWordmark compact />
        </header>
        <main className="app-shell__page">
          <Outlet />
        </main>
      </div>

      <nav className="app-shell__bottom-nav" aria-label="Nawigacja dolna Wariatkowa">
        {APP_NAV_ITEMS.map((item) => (
          <NavLink
            className={({ isActive }) => ['app-shell__bottom-link', isActive ? 'app-shell__bottom-link--active' : ''].join(' ')}
            key={item.path}
            to={item.path}
          >
            <Icon className="app-shell__nav-icon" name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
