import { Redirect } from "expo-router";
import { Heart } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/AuthProvider";
import { colors, fonts } from "../src/theme";
import { Button, Card, s } from "../src/ui";

export default function LoginScreen() {
  const { member, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  if (member) return <Redirect href="/(tabs)" />;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.orbPink} />
      <View style={styles.orbPurple} />
      <View style={styles.content}>
        <View style={styles.wordmark}>
          <Text style={styles.logo}>Wariatkowo</Text>
          <Heart color={colors.pink} fill={colors.pink} size={29} />
        </View>
        <Text style={styles.tagline}>Miśki mieszkają tu razem</Text>
        <Card style={styles.card}>
          <Text style={s.sectionTitle}>Wejdź do Wariatkowa</Text>
          <Text style={s.meta}>
            Użyj konta Google przypisanego do domowego profilu.
          </Text>
          <Button
            disabled={working}
            onPress={() => {
              setWorking(true);
              setError(null);
              void login()
                .catch((reason) =>
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Nie udało się zalogować.",
                  ),
                )
                .finally(() => setWorking(false));
            }}
            title={working ? "Otwieranie Google…" : "Zaloguj przez Google"}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Text style={s.meta}>
            Dostęp mają wyłącznie konta z domowej listy.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, overflow: "hidden" },
  content: { flex: 1, justifyContent: "center", padding: 26, gap: 8 },
  wordmark: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: {
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 40,
    letterSpacing: -1.4,
  },
  tagline: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 17,
    marginBottom: 18,
  },
  card: { padding: 20 },
  orbPink: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: colors.pinkSoft,
    top: -70,
    right: -80,
  },
  orbPurple: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.purpleSoft,
    bottom: -70,
    left: -80,
  },
});
