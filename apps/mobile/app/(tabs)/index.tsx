import * as Application from "expo-application";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text } from "react-native";
import type {
  CalendarEvent,
  MobileRelease,
  ShoppingItem,
  Task,
  TaskStats,
} from "../../../../shared/models";
import { hasNewerAndroidRelease } from "../../../../shared/mobileRelease";
import { apiBaseUrl, useAuth } from "../../src/AuthProvider";
import { cached } from "../../src/cache";
import { downloadAndInstallAndroidRelease } from "../../src/mobileRelease";
import { Button, Card, Title, s } from "../../src/ui";

const day = (date: Date) => date.toISOString().slice(0, 10);
let dismissedUpdateVersionCode: number | null = null;

type DashboardData = {
  tasks: Task[];
  shopping: ShoppingItem[];
  events: CalendarEvent[];
  stats: TaskStats | null;
};

export default function Dashboard() {
  const { member, api, logout } = useAuth();
  const [data, setData] = useState<DashboardData>({
    tasks: [],
    shopping: [],
    events: [],
    stats: null,
  });
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [update, setUpdate] = useState<MobileRelease | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const load = async () => {
    setLoading(true);
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const value = await cached("dashboard", async () => {
      const [tasks, shopping, events, stats] = await Promise.all([
        api.tasks.list(),
        api.shopping.list(),
        api.calendar.list(day(new Date()), day(end)),
        api.tasks.stats().catch(() => null),
      ]);
      return { tasks, shopping, events, stats };
    });
    setData(value.data);
    setStale(value.stale);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!member) return;
    void api.mobile
      .latest()
      .then((latest) =>
        setUpdate(
          hasNewerAndroidRelease(Application.nativeBuildVersion, latest) &&
            latest.versionCode !== dismissedUpdateVersionCode
            ? latest
            : null,
        ),
      )
      .catch(() => setUpdate(null));
  }, [api, member]);

  const install = async () => {
    setInstalling(true);
    setUpdateError(null);
    try {
      await downloadAndInstallAndroidRelease(apiBaseUrl);
    } catch (error) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : "Nie udało się otworzyć aktualizacji.",
      );
    } finally {
      setInstalling(false);
    }
  };

  const open = data.tasks.filter((item) => !item.completed);
  const shopping = data.shopping.filter((item) => !item.checked);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.screen}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} />
      }
    >
      <Title subtitle="Mały przegląd tego, co dzieje się w domu.">
        Dzień dobry, {member?.name} ❤️
      </Title>
      {update && !updateDismissed ? (
        <Card>
          <Text style={s.label}>Dostępna nowa wersja Wariatkowa</Text>
          <Text style={s.meta}>
            v{update.version} · build {update.versionCode}
          </Text>
          {updateError ? <Text style={s.error}>{updateError}</Text> : null}
          <Button
            disabled={installing}
            onPress={() => void install()}
            title={installing ? "Pobieranie…" : "Zaktualizuj"}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              dismissedUpdateVersionCode = update.versionCode;
              setUpdateDismissed(true);
            }}
          >
            <Text style={{ ...s.meta, textAlign: "center" }}>Nie teraz</Text>
          </Pressable>
        </Card>
      ) : null}
      {stale ? (
        <Text style={s.error}>Tryb offline — pokazujemy ostatnie dane.</Text>
      ) : null}
      <Card>
        <Text style={s.label}>Dzisiaj</Text>
        <Text style={s.meta}>
          {
            open.filter(
              (item) => item.dueDate?.slice(0, 10) === day(new Date()),
            ).length
          }
          {" zadań · "}
          {
            data.events.filter(
              (item) => item.startDate.slice(0, 10) === day(new Date()),
            ).length
          }
          {" wydarzeń"}
        </Text>
      </Card>
      <Card>
        <Text style={s.label}>Do zrobienia</Text>
        <Text style={s.meta}>{open.length} otwartych zadań</Text>
        {open.slice(0, 3).map((item) => (
          <Text key={item.id}>✓ {item.title}</Text>
        ))}
      </Card>
      <Card>
        <Text style={s.label}>Zakupy</Text>
        <Text style={s.meta}>{shopping.length} rzeczy do kupienia</Text>
        {shopping.slice(0, 3).map((item) => (
          <Text key={item.id}>• {item.name}</Text>
        ))}
      </Card>
      <Card>
        <Text style={s.label}>Ogarniacze tygodnia</Text>
        {data.stats?.members.map((item) => (
          <Text key={item.id}>
            {item.name}: {item.count}
          </Text>
        )) ?? <Text style={s.meta}>Statystyki pojawią się później.</Text>}
      </Card>
      <Text
        onPress={() => void logout()}
        style={{ ...s.error, textAlign: "center", padding: 12 }}
      >
        Wyloguj
      </Text>
    </ScrollView>
  );
}
