import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";
import type { HomeStatus } from "../../../../shared/models";
import { findWidgetLightId } from "@wariatkowo/api-client/src/deviceRoutes";
import { useAuth } from "../../src/AuthProvider";
import { ClimateControl, LightControl } from "../../src/HomeControls";
import { colors } from "../../src/theme";
import { EmptyState, PageHeader, State, s } from "../../src/ui";

export default function DeviceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const [status, setStatus] = useState<HomeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await api.home.status());
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się pobrać urządzenia.",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load, id]);
  const run = async (action: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się sterować urządzeniem.",
      );
    } finally {
      setPending(false);
    }
  };
  const lightId = id && status ? findWidgetLightId(status.lights, id) : null;
  const light = status?.lights.find((item) => item.id === lightId);
  const climate = id === "szumownica" ? status?.ac : null;
  const title = climate?.name ?? light?.name ?? "Urządzenie";
  return (
    <ScrollView
      contentContainerStyle={s.scrollContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.purple}
        />
      }
    >
      <PageHeader
        description={
          climate
            ? "Temperatura, nawiew i dodatkowe funkcje."
            : "Pełne ustawienia światła."
        }
        eyebrow="Dom"
        title={title}
      />
      <State
        error={error}
        loading={loading && !status}
        onRetry={() => void load()}
      />
      {light ? <LightControl busy={pending} light={light} run={run} /> : null}
      {climate ? (
        <ClimateControl busy={pending} climate={climate} run={run} />
      ) : null}
      {!loading && !light && !climate ? (
        <EmptyState
          description="Sprawdź konfigurację Home Assistant na serwerze."
          title="To urządzenie nie jest skonfigurowane."
        />
      ) : null}
      {!status?.connected && status?.message ? (
        <Text style={s.error}>{status.message}</Text>
      ) : null}
    </ScrollView>
  );
}
