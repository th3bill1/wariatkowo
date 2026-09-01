import { Redirect, Tabs, router } from "expo-router";
import { LogOut } from "lucide-react-native";
import { Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_NAV_ITEMS } from "../../../../shared/design";
import { useAuth } from "../../src/AuthProvider";
import { AppIcon } from "../../src/icons";
import { colors, fonts } from "../../src/theme";

const screenNames = ["index", "tasks", "shopping", "calendar", "home"] as const;

export default function TabsLayout() {
  const { member, logout } = useAuth();
  const insets = useSafeAreaInsets();
  if (!member) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitle: () => (
          <Text
            style={{
              color: colors.text,
              fontFamily: fonts.extraBold,
              fontSize: 20,
            }}
          >
            Wariatkowo
          </Text>
        ),
        headerRight: () => (
          <Pressable
            accessibilityLabel={`Wyloguj użytkownika ${member.name}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => void logout().then(() => router.replace("/login"))}
            style={{ marginRight: 14, padding: 8 }}
          >
            <LogOut color={colors.text} size={20} />
          </Pressable>
        ),
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.purpleSoft,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + Math.max(insets.bottom, 8),
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 2 },
      }}
    >
      {APP_NAV_ITEMS.map((item, index) => (
        <Tabs.Screen
          key={item.mobileRoute}
          name={screenNames[index]}
          options={{
            title: item.label,
            tabBarIcon: ({ color, size }) => (
              <AppIcon
                color={String(color)}
                name={item.icon}
                size={size}
                strokeWidth={2.1}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
