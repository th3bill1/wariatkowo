export type AppIconName =
  "House" | "ListChecks" | "ShoppingBasket" | "CalendarDays" | "HousePlug";

export const APP_NAV_ITEMS = [
  {
    label: "Dziś",
    webPath: "/dashboard",
    mobileRoute: "/(tabs)",
    icon: "House",
  },
  {
    label: "Zadania",
    webPath: "/zadania",
    mobileRoute: "/(tabs)/tasks",
    icon: "ListChecks",
  },
  {
    label: "Zakupy",
    webPath: "/zakupy",
    mobileRoute: "/(tabs)/shopping",
    icon: "ShoppingBasket",
  },
  {
    label: "Kalendarz",
    webPath: "/kalendarz",
    mobileRoute: "/(tabs)/calendar",
    icon: "CalendarDays",
  },
  {
    label: "Dom",
    webPath: "/home",
    mobileRoute: "/(tabs)/home",
    icon: "HousePlug",
  },
] as const;

export type HomeDeviceIconName = "Lightbulb" | "Snowflake";

export const WIDGET_DEVICES = [
  {
    route: "boskie-swiatlo",
    label: "Boskie światło",
    kind: "light",
    icon: "Lightbulb",
  },
  {
    route: "miskolampa",
    label: "Miśkolampa",
    kind: "light",
    icon: "Lightbulb",
  },
  {
    route: "szumownica",
    label: "Szumownica",
    kind: "ac",
    icon: "Snowflake",
  },
] as const;
