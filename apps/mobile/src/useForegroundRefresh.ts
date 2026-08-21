import { useEffect, useRef } from "react";
import { AppState } from "react-native";

export function useForegroundRefresh(refresh: () => void) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshRef.current();
    });
    return () => subscription.remove();
  }, []);
}
