import {
  CalendarDays,
  House,
  HousePlug,
  Lightbulb,
  ListChecks,
  ShoppingBasket,
  Snowflake,
  type LucideIcon,
  type LucideProps,
} from "lucide-react-native";
import type { AppIconName, HomeDeviceIconName } from "../../../shared/design";

const appIcons: Record<AppIconName, LucideIcon> = {
  House,
  ListChecks,
  ShoppingBasket,
  CalendarDays,
  HousePlug,
};

const deviceIcons: Record<HomeDeviceIconName, LucideIcon> = {
  Lightbulb,
  Snowflake,
};

export function AppIcon({
  name,
  ...props
}: LucideProps & { name: AppIconName }) {
  const Icon = appIcons[name];
  return <Icon aria-hidden {...props} />;
}

export function DeviceIcon({
  name,
  ...props
}: LucideProps & { name: HomeDeviceIconName }) {
  const Icon = deviceIcons[name];
  return <Icon aria-hidden {...props} />;
}
