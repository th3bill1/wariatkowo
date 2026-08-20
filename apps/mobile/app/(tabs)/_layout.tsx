import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { colors } from "../../src/theme";

const icon = (name: React.ComponentProps<typeof Ionicons>["name"]) =>
  ({ color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons color={color} name={name} size={size} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.coral,
        tabBarStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Start", tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="tasks" options={{ title: "Zadania", tabBarIcon: icon("checkmark-circle-outline") }} />
      <Tabs.Screen name="shopping" options={{ title: "Zakupy", tabBarIcon: icon("cart-outline") }} />
      <Tabs.Screen name="calendar" options={{ title: "Kalendarz", tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="home" options={{ title: "Dom", tabBarIcon: icon("bulb-outline") }} />
    </Tabs>
  );
}
