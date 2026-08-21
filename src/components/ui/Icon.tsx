import {
  House,
  ListChecks,
  ShoppingBasket,
  CalendarDays,
  HousePlug,
  type LucideIcon,
} from "lucide-react";
import type { AppIconName } from "../../../shared/design";

type IconProps = {
  name: AppIconName;
  className?: string;
};

const ICONS: Record<AppIconName, LucideIcon> = {
  House,
  ListChecks,
  ShoppingBasket,
  CalendarDays,
  HousePlug,
};

export function Icon({ name, className }: IconProps) {
  const IconComponent = ICONS[name];

  return <IconComponent aria-hidden="true" className={className} />;
}
