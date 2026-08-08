import { Link } from "react-router-dom";
import { APP_SHELL_COPY } from "../../content/appShell";

type AppWordmarkProps = {
  compact?: boolean;
};

export function AppWordmark({ compact = false }: AppWordmarkProps) {
  return (
    <Link
      className={["app-wordmark", compact ? "app-wordmark--compact" : ""].join(
        " ",
      )}
      to="/dashboard"
    >
      <span className="app-wordmark__name">{APP_SHELL_COPY.brand}</span>
    </Link>
  );
}
