import {
  House,
  ListChecks,
  ShoppingBasket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type IconName = "home" | "tasks" | "shopping" | "quiz";

type IconProps = {
  name: IconName;
  className?: string;
};

const ICONS: Record<IconName, LucideIcon> = {
  home: House,
  tasks: ListChecks,
  shopping: ShoppingBasket,
  quiz: Sparkles,
};

export function Icon({ name, className }: IconProps) {
  const IconComponent = ICONS[name];

  return <IconComponent aria-hidden="true" className={className} />;
}
