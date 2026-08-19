export const APP_SHELL_COPY = {
  brand: "Wariatkowo",
  moreSections: "Więcej sekcji pojawi się później.",
} as const;

export const APP_NAV_ITEMS = [
  { label: "Dziś", path: "/dashboard", icon: "home" },
  { label: "Zadania", path: "/zadania", icon: "tasks" },
  { label: "Zakupy", path: "/zakupy", icon: "shopping" },
  { label: "Kalendarz", path: "/kalendarz", icon: "calendar" },
  { label: "Dom", path: "/home", icon: "smart-home" },
] as const;
