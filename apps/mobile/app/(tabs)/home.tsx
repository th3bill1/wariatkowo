import { PlusSquare, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WIDGET_DEVICES } from "../../../../shared/design";
import type { HomeStatus } from "../../../../shared/models";
import { useAuth } from "../../src/AuthProvider";
import { cached } from "../../src/cache";
import { ClimateControl, LightControl } from "../../src/HomeControls";
import { DeviceIcon } from "../../src/icons";
import { colors } from "../../src/theme";
import { useForegroundRefresh } from "../../src/useForegroundRefresh";
import { refreshWidget, requestPinWidget } from "../../src/widgetBridge";
import {
  Button,
  Card,
  PageHeader,
  SectionHeader,
  State,
  s,
} from "../../src/ui";

export default function HomeScreen() {
  const { api } = useAuth();
  const [status, setStatus] = useState<HomeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [addingWidget, setAddingWidget] = useState(false);
  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const result = await cached("home", () => api.home.status());
        setStatus(result.data);
        setError(
          result.stale
            ? "Tryb offline — sterowanie jest wyłączone."
            : result.data.connected
              ? null
              : (result.data.message ?? "Home Assistant jest niedostępny."),
        );
        if (!result.stale) void refreshWidget().catch(() => undefined);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Nie udało się pobrać stanu domu.",
        );
      } finally {
        setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(false), 15_000);
    return () => clearInterval(timer);
  }, [load]);
  useForegroundRefresh(() => void load(false));
  const run = async (action: () => Promise<unknown>) => {
    if (pending || !status?.connected) return;
    setPending(true);
    setActionError(null);
    try {
      await action();
      await load(false);
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się wykonać operacji.",
      );
    } finally {
      setPending(false);
    }
  };
  const addWidget = async () => {
    setAddingWidget(true);
    try {
      const result = await requestPinWidget();
      if (result.requested) {
        Alert.alert(
          "Dodaj widget",
          "Potwierdź dodanie widgetu w oknie launchera. Android nie wymaga do tego osobnego uprawnienia.",
        );
      } else {
        Alert.alert(
          "Dodaj widget ręcznie",
          "Ten launcher nie obsługuje automatycznej prośby. Przytrzymaj puste miejsce na ekranie głównym, wybierz Widgety, znajdź Wariatkowo i przeciągnij widget na ekran.",
        );
      }
    } catch (reason) {
      Alert.alert(
        "Nie udało się otworzyć wyboru widgetu",
        reason instanceof Error
          ? reason.message
          : "Dodaj go ręcznie z listy widgetów launchera.",
      );
    } finally {
      setAddingWidget(false);
    }
  };
  const configured = (status?.lights.length ?? 0) + (status?.ac ? 1 : 0);
  return (
    <ScrollView
      contentContainerStyle={s.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.purple}
        />
      }
    >
      <PageHeader
        description="Wszystko pod ręką."
        eyebrow="Wariatkowo pod kontrolą"
        title="Dom"
      />
      {status ? (
        <View
          style={[
            styles.connection,
            !status.connected && styles.connectionOffline,
          ]}
        >
          <View
            style={[
              styles.connectionDot,
              !status.connected && styles.connectionDotOffline,
            ]}
          />
          <View style={s.grow}>
            <Text style={s.label}>
              {status.connected
                ? "Dom jest połączony"
                : "Home Assistant jest chwilowo niedostępny"}
            </Text>
            {!status.connected && status.message ? (
              <Text style={s.meta}>{status.message}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <State
        error={error}
        loading={loading && !status}
        loadingLabel="Sprawdzamy, co słychać w domu…"
        onRetry={() => void load()}
      />
      {actionError ? (
        <View style={s.errorBox}>
          <Text style={s.error}>{actionError}</Text>
        </View>
      ) : null}

      <Card>
        <SectionHeader
          description="Boskie światło, Miśkolampa i Szumownica zawsze pod ręką."
          title="Widget ekranu głównego"
        />
        <View style={styles.widgetDevices}>
          {WIDGET_DEVICES.map((device) => (
            <View key={device.route} style={styles.widgetDevice}>
              <DeviceIcon
                color={device.kind === "light" ? "#9B6A19" : "#3777A6"}
                name={device.icon}
                size={20}
              />
              <Text style={s.body}>{device.label}</Text>
            </View>
          ))}
        </View>
        <Button
          disabled={addingWidget}
          Icon={PlusSquare}
          onPress={() => void addWidget()}
          title={addingWidget ? "Otwieranie…" : "Dodaj widget"}
        />
      </Card>

      {status?.scenes.length ? (
        <Card>
          <SectionHeader
            description="Jedno kliknięcie, kilka rzeczy dzieje się naraz."
            title="Domowe tryby"
          />
          <View style={s.wrap}>
            {status.scenes.map((scene) => (
              <Button
                disabled={pending || !status.connected}
                Icon={Sparkles}
                key={scene.id}
                onPress={() => void run(() => api.home.scene(scene.id))}
                title={scene.name}
              />
            ))}
          </View>
        </Card>
      ) : null}
      {status?.lights.length ? (
        <View style={styles.section}>
          <SectionHeader description="I wszystko jasne." title="Światła" />
          {status.lights.map((light) => (
            <LightControl
              busy={pending || !status.connected}
              key={light.id}
              light={light}
              run={run}
            />
          ))}
        </View>
      ) : null}
      {status?.ac ? (
        <View style={styles.section}>
          <SectionHeader
            description="Temperatura, nawiew i dodatkowe funkcje."
            title="Szumownica"
          />
          <ClimateControl
            busy={pending || !status.connected}
            climate={status.ac}
            run={run}
          />
        </View>
      ) : null}
      {status && !configured ? (
        <Card>
          <SectionHeader
            description="Dodaj encje Home Assistant w pliku .env na serwerze."
            title="Dom czeka na konfigurację"
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  connection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    padding: 13,
    backgroundColor: colors.greenSoft,
  },
  connectionOffline: { backgroundColor: colors.dangerSoft },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.greenDark,
  },
  connectionDotOffline: { backgroundColor: colors.textDanger },
  widgetDevices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  widgetDevice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: 9,
    borderRadius: 13,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
