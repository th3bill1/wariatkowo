import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { TaskStats } from "../../shared/models";
import { useAuth } from "../auth/AuthContext";
import { AppCard } from "../components/ui/AppCard";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/SectionHeader";
import { WariatkowoStatus } from "../components/WariatkowoStatus";
import { DASHBOARD_COPY } from "../content/dashboard";
import { LOADING_COPY } from "../content/loading";
import { WARIATKOWO_STATUSES } from "../content/statuses";
import { useShopping } from "../hooks/useShopping";
import { useTasks } from "../hooks/useTasks";
import { taskStatsService } from "../services/taskStatsService";
import { useCalendar } from "../hooks/useCalendar";
import { CALENDAR_TYPES } from "../content/calendar";
import { PolaroidPhoto } from "../components/PolaroidPhoto";
import { POLAROID_PHOTOS } from "../content/polaroids";
import { randomUniqueItems } from "../utils/randomSelection";
import { HomeSummaryCard } from "../components/home/HomeSummaryCard";

const pick = <T,>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];
const dayKey = (value: Date | string) =>
  new Date(value).toISOString().slice(0, 10);
function relativeTime(value: string): string {
  const hours = Math.floor((Date.now() - Date.parse(value)) / 3_600_000);
  if (hours < 1) return "przed chwilą";
  if (hours < 24) return hours + " godz. temu";
  if (hours < 48) return "wczoraj";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}
export function DashboardPage() {
  const { member } = useAuth();
  const {
    tasks,
    loadState: taskState,
    error: taskError,
    refresh: refreshTasks,
  } = useTasks();
  const {
    items,
    loadState: shoppingState,
    error: shoppingError,
    refresh: refreshShopping,
  } = useShopping();
  const [status] = useState(() => pick(WARIATKOWO_STATUSES));
  const [dashboardPhotos] = useState(() =>
    randomUniqueItems(POLAROID_PHOTOS, 3).map((photo, index) => ({
      ...photo,
      rotation: [-5, 1.5, 5][index],
    })),
  );
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const calendarFrom = dayKey(new Date());
  const calendarEnd = new Date();
  calendarEnd.setDate(calendarEnd.getDate() + 14);
  const { events: calendarEvents } = useCalendar(
    calendarFrom,
    dayKey(calendarEnd),
  );
  const [stats, setStats] = useState<TaskStats | null>(null);
  useEffect(() => {
    void taskStatsService
      .get(7)
      .then(setStats)
      .catch(() => setStats(null));
  }, [tasks]);
  const open = tasks.filter((task) => !task.completed),
    shopping = items.filter((item) => !item.checked);
  const today = dayKey(new Date());
  const overdue = open.filter(
    (task) => task.dueDate && dayKey(task.dueDate) < today,
  ).length;
  const dueToday = open.filter(
    (task) => task.dueDate && dayKey(task.dueDate) === today,
  ).length;
  const mine = open.filter((task) => task.assignment === member?.slug).length;
  const todayEvents = calendarEvents.filter(
    (event) => dayKey(event.startDate) === today,
  );
  const importantTasks = open
    .filter((task) => task.dueDate && dayKey(task.dueDate) <= today)
    .slice(0, 3);
  const recurringSoon = open
    .filter(
      (task) =>
        task.recurrence &&
        task.dueDate &&
        dayKey(task.dueDate) <= dayKey(calendarEnd),
    )
    .slice(0, 3);
  return (
    <div className="dashboard-page__surface">
      <div className="dashboard-hero">
        <PageHeader
          eyebrow={"Dzień dobry, " + member?.name + " ❤️"}
          title={DASHBOARD_COPY.heading}
          description="Mały przegląd tego, co dzieje się w Wariatkowie."
        />
        {dashboardPhotos.length ? (
          <div className="dashboard-polaroids" aria-hidden="true">
            {dashboardPhotos.map((photo, index) => (
              <PolaroidPhoto
                className={`dashboard-polaroid dashboard-polaroid--${index + 1}`}
                key={photo.src}
                loading={index === 0 ? "eager" : "lazy"}
                position={photo.position}
                rotation={photo.rotation}
                size="small"
                src={photo.src}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="dashboard-summary-bar">
        <div className="task-summary" aria-label="Podsumowanie zadań">
          <span>
            <strong>{mine}</strong> dla Ciebie
          </span>
          <span>
            <strong>{dueToday}</strong> na dziś
          </span>
          <span className={overdue ? "task-summary__alert" : ""}>
            <strong>{overdue}</strong> po terminie
          </span>
        </div>
        <div className="dashboard-quick-add">
          <button
            aria-expanded={quickActionsOpen}
            aria-label={
              quickActionsOpen ? "Zamknij szybkie dodawanie" : "Dodaj"
            }
            className="dashboard-quick-add__toggle"
            onClick={() => setQuickActionsOpen((open) => !open)}
            type="button"
          >
            {quickActionsOpen ? <X /> : <Plus />}
          </button>
          {quickActionsOpen ? (
            <div
              className="dashboard-quick-actions"
              aria-label="Szybkie dodawanie"
            >
              <Link to="/zadania?add=1">Zadanie</Link>
              <Link to="/zakupy">Zakupy</Link>
              <Link to="/kalendarz?add=1">Wydarzenie</Link>
            </div>
          ) : null}
        </div>
      </div>
      <div className="dashboard-grid">
        <AppCard className="dashboard-card dashboard-card--today">
          <SectionHeader
            title="Dziś"
            description={new Intl.DateTimeFormat("pl-PL", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          />
          {importantTasks.length || todayEvents.length ? (
            <ul className="dashboard-preview-list">
              {importantTasks.map((task) => (
                <li className="dashboard-preview-list__item" key={task.id}>
                  <Link to="/zadania">
                    <strong>
                      {dayKey(task.dueDate!) < today ? "⚠ " : "✓ "}
                      {task.title}
                    </strong>
                  </Link>
                </li>
              ))}
              {todayEvents.slice(0, 3).map((event) => (
                <li className="dashboard-preview-list__item" key={event.id}>
                  <Link to="/kalendarz">
                    <strong>
                      📅{" "}
                      {event.allDay
                        ? ""
                        : new Intl.DateTimeFormat("pl-PL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(event.startDate)) + " — "}
                      {event.title}
                    </strong>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Podejrzanie spokojnie."
              description="Na dziś nic pilnego."
            />
          )}
        </AppCard>
        <HomeSummaryCard />
        <AppCard className="dashboard-card dashboard-card--tasks">
          <SectionHeader
            title={DASHBOARD_COPY.taskCardTitle}
            description={open.length + " rzeczy do zrobienia"}
            actions={
              <Link className="app-link-button" to="/zadania">
                {DASHBOARD_COPY.tasksLink}
              </Link>
            }
          />
          {taskState === "loading" ? (
            <LoadingState label={LOADING_COPY.tasks} />
          ) : null}
          {taskState === "error" ? (
            <ErrorState
              description={taskError ?? "Nie udało się pobrać zadań."}
              onRetry={refreshTasks}
              title="Nie udało się pobrać zadań."
            />
          ) : null}
          {taskState === "ready" && !open.length ? (
            <EmptyState
              description={DASHBOARD_COPY.tasksEmpty}
              title="Nic do roboty. Podejrzane."
            />
          ) : null}
          {open.length ? (
            <ul className="dashboard-preview-list">
              {open.slice(0, 3).map((task) => (
                <li className="dashboard-preview-list__item" key={task.id}>
                  <div>
                    <p className="dashboard-preview-list__title">
                      {task.title}
                    </p>
                    <p className="dashboard-preview-list__meta">
                      {task.assignment === member?.slug
                        ? "Dla Ciebie"
                        : task.assignment === "both"
                          ? "Dla nas"
                          : task.assignment === "anyone"
                            ? "Dla kogokolwiek"
                            : task.assignment === "miska"
                              ? "Miśka"
                              : "Misiek"}
                      {task.recurrence ? " · Powtarzalne" : ""}
                    </p>
                  </div>
                  {task.dueDate ? (
                    <span className="dashboard-preview-list__badge">
                      {dayKey(task.dueDate) === today
                        ? "Dzisiaj"
                        : dayKey(task.dueDate) < today
                          ? "Po terminie"
                          : new Intl.DateTimeFormat("pl-PL", {
                              day: "numeric",
                              month: "short",
                            }).format(new Date(task.dueDate))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </AppCard>
        <AppCard className="dashboard-card dashboard-card--shopping">
          <SectionHeader
            title={DASHBOARD_COPY.shoppingCardTitle}
            description={shopping.length + " rzeczy do kupienia"}
            actions={
              <Link className="app-link-button" to="/zakupy">
                {DASHBOARD_COPY.shoppingLink}
              </Link>
            }
          />
          {shoppingState === "loading" ? (
            <LoadingState label={LOADING_COPY.shopping} />
          ) : null}
          {shoppingState === "error" ? (
            <ErrorState
              description={shoppingError ?? "Nie udało się pobrać zakupów."}
              onRetry={refreshShopping}
              title="Nie udało się pobrać zakupów."
            />
          ) : null}
          {shoppingState === "ready" && !shopping.length ? (
            <EmptyState
              description={DASHBOARD_COPY.shoppingEmpty}
              title="Lista pusta."
            />
          ) : null}
          {shopping.length ? (
            <>
              <ul className="dashboard-preview-list">
                {[...shopping]
                  .sort(
                    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
                  )
                  .slice(0, 3)
                  .map((item) => (
                    <li className="dashboard-preview-list__item" key={item.id}>
                      <div>
                        <p className="dashboard-preview-list__title">
                          {item.name}
                        </p>
                        {item.quantity || item.category ? (
                          <p className="dashboard-preview-list__meta">
                            {[item.quantity, item.category]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
              </ul>
              <Link
                className="secondary-button dashboard-shop-mode"
                to="/zakupy/sklep"
              >
                Tryb sklepowy
              </Link>
            </>
          ) : null}
        </AppCard>
        {recurringSoon.length ? (
          <AppCard className="dashboard-card dashboard-card--recurring">
            <SectionHeader
              title="Nadchodzące obowiązki"
              description="Powtarzalne, więc same wrócą."
            />
            <ul className="dashboard-preview-list">
              {recurringSoon.map((task) => (
                <li className="dashboard-preview-list__item" key={task.id}>
                  <div>
                    <p className="dashboard-preview-list__title">
                      {task.title} ↻
                    </p>
                    <p className="dashboard-preview-list__meta">
                      {new Intl.DateTimeFormat("pl-PL", {
                        day: "numeric",
                        month: "long",
                      }).format(new Date(task.dueDate!))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </AppCard>
        ) : null}
        <AppCard className="dashboard-card dashboard-card--calendar">
          <SectionHeader
            title="Najbliższe"
            description="Co nadciąga do Wariatkowa?"
            actions={
              <Link className="app-link-button" to="/kalendarz">
                Kalendarz
              </Link>
            }
          />
          {calendarEvents.length ? (
            <ul className="dashboard-preview-list">
              {calendarEvents.slice(0, 3).map((event) => {
                const meta = CALENDAR_TYPES.find(
                  (item) => item.value === event.type,
                );
                return (
                  <li className="dashboard-preview-list__item" key={event.id}>
                    <div>
                      <p className="dashboard-preview-list__title">
                        {meta?.icon} {event.title}
                      </p>
                      <p className="dashboard-preview-list__meta">
                        {dayKey(event.startDate) === today
                          ? "Dziś"
                          : new Intl.DateTimeFormat("pl-PL", {
                              day: "numeric",
                              month: "long",
                            }).format(new Date(event.startDate))}
                        {event.allDay
                          ? ""
                          : " · " +
                            new Intl.DateTimeFormat("pl-PL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(event.startDate))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="Nic na horyzoncie"
              description="Kalendarz milczy."
            />
          )}
        </AppCard>
        <AppCard className="dashboard-card dashboard-card--stats">
          <SectionHeader
            title="Kto ostatnio ogarnia Wariatkowo?"
            description="Ukończone własne zadania z ostatnich 7 dni."
          />
          {stats ? (
            <>
              <div className="task-stats">
                {stats.members.map((person) => (
                  <div className="task-stat" key={person.id}>
                    <div>
                      <strong>{person.name}</strong>
                      <span>{person.count} zadań</span>
                    </div>
                    <div className="task-stat__track">
                      <span
                        style={{
                          width:
                            Math.min(
                              100,
                              (person.count /
                                Math.max(
                                  1,
                                  ...stats.members.map((item) => item.count),
                                )) *
                                100,
                            ) + "%",
                        }}
                      />
                    </div>
                  </div>
                ))}
                {stats.sharedCount ? (
                  <p className="task-stats__shared">
                    Wspólnie ogarnięte: {stats.sharedCount}
                  </p>
                ) : null}
              </div>
              {stats.recentActivity.length ? (
                <ul className="activity-list">
                  {stats.recentActivity.map((event) => (
                    <li key={event.id}>
                      <span>
                        <strong>{event.member.name}</strong> — {event.title}
                      </span>
                      <time dateTime={event.completedAt}>
                        {relativeTime(event.completedAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="state-copy">
              Statystyki pojawią się po pierwszych ukończonych zadaniach.
            </p>
          )}
        </AppCard>
        <AppCard className="dashboard-card dashboard-card--status">
          <SectionHeader
            title={DASHBOARD_COPY.statusCardTitle}
            description="Miśki mocno się kochają."
          />
          <WariatkowoStatus status={status} />
        </AppCard>
      </div>
    </div>
  );
}
