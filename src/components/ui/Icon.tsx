import {
  House,
  ListChecks,
  ShoppingBasket,
  Sparkles,
  CalendarDays,
  HousePlug,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "home"
  | "tasks"
  | "shopping"
  | "quiz"
  | "calendar"
  | "smart-home";

type IconProps = {
  name: IconName;
  className?: string;
};

const ICONS: Record<IconName, LucideIcon> = {
  home: House,
  tasks: ListChecks,
  shopping: ShoppingBasket,
  quiz: Sparkles,
  calendar: CalendarDays,
  "smart-home": HousePlug,
};

export function Icon({ name, className }: IconProps) {
  const IconComponent = ICONS[name];

  return <IconComponent aria-hidden="true" className={className} />;
}
