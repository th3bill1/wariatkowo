import * as Application from "expo-application";
import { router, type Href } from "expo-router";
import {
  CalendarDays,
  Check,
  Download,
  HousePlug,
  Plus,
  Repeat2,
  ShoppingBasket,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CALENDAR_TYPES } from "../../../../shared/calendar";
import { TASK_ASSIGNMENT_LABELS } from "../../../../shared/labels";
import type {
  CalendarEvent,
  HomeStatus,
  MobileRelease,
  ShoppingItem,
  Task,
  TaskStats,
} from "../../../../shared/models";
import { hasNewerAndroidRelease } from "../../../../shared/mobileRelease";
import { apiBaseUrl, useAuth } from "../../src/AuthProvider";
import { cached } from "../../src/cache";
import { dateKey, relativeTime } from "../../src/date";
import { downloadAndInstallAndroidRelease } from "../../src/mobileRelease";
import { colors, fonts } from "../../src/theme";
import { useForegroundRefresh } from "../../src/useForegroundRefresh";
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  SectionHeader,
  State,
  s,
} from "../../src/ui";

const statuses = [
  "Stan Wariatkowa: totalna rozpierducha",
  "Stan Wariatkowa: pełne miłości",
  "Stan Wariatkowa: potrzebny buldak i strongi",
] as const;
let dismissedUpdateVersionCode: number | null = null;

type DashboardData = {
  tasks: Task[];
  shopping: ShoppingItem[];
  events: CalendarEvent[];
  stats: TaskStats | null;
  home: HomeStatus | null;
};

function PreviewRow({
  title,
  meta,
  badge,
  onPress,
}: {
  title: string;
  meta?: string;
  badge?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.preview, pressed && s.pressed]}
    >
      <View style={s.grow}>
        <Text style={s.label}>{title}</Text>
        {meta ? <Text style={s.meta}>{meta}</Text> : null}
      </View>
      {badge ? <Text style={s.badge}>{badge}</Text> : null}
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { member, api } = useAuth();
  const [data, setData] = useState<DashboardData>({
    tasks: [],
    shopping: [],
    events: [],
    stats: null,
    home: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [status] = useState(
    () => statuses[Math.floor(Math.random() * statuses.length)],
  );
  const [update, setUpdate] = useState<MobileRelease | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      const end = new Date();
      end.setDate(end.getDate() + 14);
      try {
        const result = await cached("dashboard", async () => {
          const [tasks, shopping, events, stats, home] = await Promise.all([
            api.tasks.list(),
            api.shopping.list(),
            api.calendar.list(dateKey(new Date()), dateKey(end)),
            api.tasks.stats().catch(() => null),
            api.home.status().catch(() => null),
          ]);
          return { tasks, shopping, events, stats, home };
        });
        setData(result.data);
        setStale(result.stale);
        setError(null);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Nie udało się pobrać pulpitu.",
        );
      } finally {
        setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => void load(), [load]);
  useForegroundRefresh(() => void load(false));
  useEffect(() => {
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
  }, [api]);

  const today = dateKey(new Date());
  const end = new Date();
  end.setDate(end.getDate() + 14);
  const open = data.tasks.filter((task) => !task.completed);
  const shopping = data.shopping.filter((item) => !item.checked);
  const overdue = open.filter(
    (task) => task.dueDate && dateKey(task.dueDate) < today,
  ).length;
  const dueToday = open.filter(
    (task) => task.dueDate && dateKey(task.dueDate) === today,
  ).length;
  const mine = open.filter((task) => task.assignment === member?.slug).length;
  const todayEvents = data.events.filter(
    (event) => dateKey(event.startDate) === today,
  );
  const importantTasks = open
    .filter((task) => task.dueDate && dateKey(task.dueDate) <= today)
    .slice(0, 3);
  const recurringSoon = open
    .filter(
      (task) =>
        task.recurrence &&
        task.dueDate &&
        dateKey(task.dueDate) <= dateKey(end),
    )
    .slice(0, 3);
  const homeLightCount =
    data.home?.lights.filter((light) => light.state === "on").length ?? 0;
  const currentDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [],
  );
  const install = async () => {
    setInstalling(true);
    setUpdateError(null);
    try {
      await downloadAndInstallAndroidRelease(apiBaseUrl);
    } catch (reason) {
      setUpdateError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się otworzyć aktualizacji.",
      );
    } finally {
      setInstalling(false);
    }
  };

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
        description="Mały przegląd tego, co dzieje się w Wariatkowie."
        eyebrow={`Dzień dobry, ${member?.name} ❤️`}
        title="Wariatkowo dziś"
      />
      <View style={styles.summaryBar}>
        <View style={styles.summaryChips}>
          <Text style={styles.summaryChip}>
            <Text style={styles.summaryNumber}>{mine}</Text> dla Ciebie
          </Text>
          <Text style={styles.summaryChip}>
            <Text style={styles.summaryNumber}>{dueToday}</Text> na dziś
          </Text>
          <Text style={[styles.summaryChip, overdue > 0 && styles.alertChip]}>
            <Text style={styles.summaryNumber}>{overdue}</Text> po terminie
          </Text>
        </View>
        <IconButton
          Icon={quickOpen ? X : Plus}
          label={quickOpen ? "Zamknij szybkie dodawanie" : "Dodaj"}
          onPress={() => setQuickOpen((open) => !open)}
        />
      </View>
      {quickOpen ? (
        <Card>
          <SectionHeader title="Szybkie dodawanie" />
          <View style={s.wrap}>
            <Button
              Icon={Check}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/tasks",
                  params: { add: String(Date.now()) },
                } as Href)
              }
              title="Zadanie"
            />
            <Button
              Icon={ShoppingBasket}
              onPress={() => router.push("/(tabs)/shopping")}
              title="Zakupy"
              variant="secondary"
            />
            <Button
              Icon={CalendarDays}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/calendar",
                  params: { add: String(Date.now()) },
                } as Href)
              }
              title="Wydarzenie"
              variant="secondary"
            />
          </View>
        </Card>
      ) : null}
      {update && !updateDismissed ? (
        <Card>
          <SectionHeader
            description={`v${update.version} · build ${update.versionCode}`}
            title="Dostępna nowa wersja Wariatkowa"
          />
          {updateError ? <Text style={s.error}>{updateError}</Text> : null}
          <Button
            disabled={installing}
            Icon={Download}
            onPress={() => void install()}
            title={installing ? "Pobieranie…" : "Zaktualizuj"}
          />
          <Button
            onPress={() => {
              dismissedUpdateVersionCode = update.versionCode;
              setUpdateDismissed(true);
            }}
            title="Nie teraz"
            variant="ghost"
          />
        </Card>
      ) : null}
      {stale ? (
        <Text style={s.error}>Tryb offline — pokazujemy ostatnie dane.</Text>
      ) : null}
      <State
        error={error}
        loading={loading && !data.tasks.length && !data.shopping.length}
        loadingLabel="Sprawdzamy, co się odwala."
        onRetry={() => void load()}
      />

      <Card>
        <SectionHeader description={currentDateLabel} title="Dziś" />
        {importantTasks.length || todayEvents.length ? (
          <View>
            {importantTasks.map((task) => (
              <PreviewRow
                key={task.id}
                onPress={() => router.push("/(tabs)/tasks")}
                title={`${dateKey(task.dueDate!) < today ? "⚠" : "✓"} ${task.title}`}
              />
            ))}
            {todayEvents.slice(0, 3).map((event) => (
              <PreviewRow
                key={event.id}
                onPress={() => router.push("/(tabs)/calendar")}
                title={`📅 ${event.allDay ? "" : `${new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.startDate))} — `}${event.title}`}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            description="Na dziś nic pilnego."
            title="Podejrzanie spokojnie."
          />
        )}
      </Card>

      <Card>
        <SectionHeader
          action={
            <Button
              compact
              onPress={() => router.push("/(tabs)/home")}
              title="Otwórz →"
              variant="ghost"
            />
          }
          description={
            data.home?.connected
              ? "Home Assistant połączony"
              : "Sterowanie domem"
          }
          title="Dom"
        />
        <PreviewRow title={`${homeLightCount} światła włączone`} />
        {data.home && !data.home.connected ? (
          <Text style={s.meta}>Urządzenia mogą być chwilowo offline.</Text>
        ) : null}
      </Card>

      <Card>
        <SectionHeader
          action={
            <Button
              compact
              onPress={() => router.push("/(tabs)/tasks")}
              title="Wszystkie →"
              variant="ghost"
            />
          }
          description={`${open.length} rzeczy do zrobienia`}
          title="Zadania"
        />
        {open.length ? (
          open
            .slice(0, 3)
            .map((task) => (
              <PreviewRow
                badge={
                  task.dueDate
                    ? dateKey(task.dueDate) === today
                      ? "Dzisiaj"
                      : dateKey(task.dueDate) < today
                        ? "Po terminie"
                        : new Intl.DateTimeFormat("pl-PL", {
                            day: "numeric",
                            month: "short",
                          }).format(new Date(task.dueDate))
                    : undefined
                }
                key={task.id}
                meta={`${task.assignment === member?.slug ? "Dla Ciebie" : TASK_ASSIGNMENT_LABELS[task.assignment]}${task.recurrence ? " · Powtarzalne" : ""}`}
                onPress={() => router.push("/(tabs)/tasks")}
                title={task.title}
              />
            ))
        ) : (
          <EmptyState
            description="Nic do roboty."
            title="Nic do roboty. Podejrzane."
          />
        )}
      </Card>

      <Card>
        <SectionHeader
          action={
            <Button
              compact
              onPress={() => router.push("/(tabs)/shopping")}
              title="Cała lista →"
              variant="ghost"
            />
          }
          description={`${shopping.length} rzeczy do kupienia`}
          title="Zakupy"
        />
        {shopping.length ? (
          [...shopping]
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .slice(0, 3)
            .map((item) => (
              <PreviewRow
                key={item.id}
                meta={[item.quantity, item.category]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() => router.push("/(tabs)/shopping")}
                title={item.name}
              />
            ))
        ) : (
          <EmptyState description="Lista pusta." title="Lista pusta." />
        )}
        {shopping.length ? (
          <Button
            Icon={ShoppingBasket}
            onPress={() => router.push("/shopping/shop-mode" as Href)}
            title="Tryb sklepowy"
            variant="secondary"
          />
        ) : null}
      </Card>

      {recurringSoon.length ? (
        <Card>
          <SectionHeader
            description="Powtarzalne, więc same wrócą."
            title="Nadchodzące obowiązki"
          />
          {recurringSoon.map((task) => (
            <PreviewRow
              key={task.id}
              meta={new Intl.DateTimeFormat("pl-PL", {
                day: "numeric",
                month: "long",
              }).format(new Date(task.dueDate!))}
              title={`${task.title} ↻`}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionHeader
          action={
            <Button
              compact
              onPress={() => router.push("/(tabs)/calendar")}
              title="Kalendarz"
              variant="ghost"
            />
          }
          description="Co nadciąga do Wariatkowa?"
          title="Najbliższe"
        />
        {data.events.length ? (
          data.events.slice(0, 3).map((event) => {
            const meta = CALENDAR_TYPES.find(
              (item) => item.value === event.type,
            );
            return (
              <PreviewRow
                key={event.id}
                meta={`${dateKey(event.startDate) === today ? "Dziś" : new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" }).format(new Date(event.startDate))}${event.allDay ? "" : ` · ${new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.startDate))}`}`}
                onPress={() => router.push("/(tabs)/calendar")}
                title={`${meta?.icon ?? "📌"} ${event.title}`}
              />
            );
          })
        ) : (
          <EmptyState
            description="Kalendarz milczy."
            title="Nic na horyzoncie"
          />
        )}
      </Card>

      <Card>
        <SectionHeader
          description="Ukończone własne zadania z ostatnich 7 dni."
          title="Kto ostatnio ogarnia Wariatkowo?"
        />
        {data.stats ? (
          <View style={styles.stats}>
            {data.stats.members.map((person) => {
              const maximum = Math.max(
                1,
                ...data.stats!.members.map((value) => value.count),
              );
              return (
                <View key={person.id} style={styles.stat}>
                  <View style={s.spaceBetween}>
                    <Text style={s.label}>{person.name}</Text>
                    <Text style={s.meta}>{person.count} zadań</Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.progress,
                        {
                          width: `${Math.min(100, (person.count / maximum) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
            {data.stats.sharedCount ? (
              <Text style={s.meta}>
                Wspólnie ogarnięte: {data.stats.sharedCount}
              </Text>
            ) : null}
            {data.stats.recentActivity.map((activity) => (
              <PreviewRow
                key={activity.id}
                badge={relativeTime(activity.completedAt)}
                title={`${activity.member.name} — ${activity.title}`}
              />
            ))}
          </View>
        ) : (
          <Text style={s.meta}>
            Statystyki pojawią się po pierwszych ukończonych zadaniach.
          </Text>
        )}
      </Card>

      <Card>
        <SectionHeader
          description="Miśki mocno się kochają."
          title="Stan Wariatkowa"
        />
        <Text style={styles.status}>{status}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  summaryChip: {
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 12,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    overflow: "hidden",
  },
  summaryNumber: { fontFamily: fonts.extraBold },
  alertChip: { color: colors.textDanger, backgroundColor: colors.dangerSoft },
  preview: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stats: { gap: 12 },
  stat: { gap: 5 },
  track: {
    height: 8,
    backgroundColor: colors.purpleSoft,
    borderRadius: 4,
    overflow: "hidden",
  },
  progress: { height: 8, backgroundColor: colors.purple, borderRadius: 4 },
  status: {
    color: colors.purpleDark,
    fontFamily: fonts.extraBold,
    fontSize: 18,
    lineHeight: 25,
  },
});
