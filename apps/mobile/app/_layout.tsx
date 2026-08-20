import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/AuthProvider";
import { colors } from "../src/theme";
export default function Root() { return <AuthProvider><StatusBar style="dark"/><Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.ink, contentStyle: { backgroundColor: colors.background } }}><Stack.Screen name="index" options={{ headerShown: false }}/><Stack.Screen name="login" options={{ headerShown: false }}/><Stack.Screen name="(tabs)" options={{ headerShown: false }}/><Stack.Screen name="devices/[id]" options={{ title: "Urządzenie" }}/><Stack.Screen name="auth/callback" options={{ headerShown: false }}/></Stack></AuthProvider> }
