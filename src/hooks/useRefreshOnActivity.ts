import { useEffect } from "react";

type RefreshOnActivityOptions = {
  focus?: boolean;
  online?: boolean;
  visibility?: boolean;
};

/** Refreshes server-backed state when the browser becomes active again. */
export function useRefreshOnActivity(
  refresh: () => void | Promise<void>,
  options: RefreshOnActivityOptions = {},
): void {
  const { focus = true, online = true, visibility = true } = options;

  useEffect(() => {
    const runRefresh = () => void refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") runRefresh();
    };

    if (focus) window.addEventListener("focus", runRefresh);
    if (online) window.addEventListener("online", runRefresh);
    if (visibility) {
      document.addEventListener("visibilitychange", refreshWhenVisible);
    }

    return () => {
      if (focus) window.removeEventListener("focus", runRefresh);
      if (online) window.removeEventListener("online", runRefresh);
      if (visibility) {
        document.removeEventListener("visibilitychange", refreshWhenVisible);
      }
    };
  }, [focus, online, refresh, visibility]);
}
