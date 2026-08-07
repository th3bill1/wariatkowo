import { Link } from 'react-router-dom';
import { AppCard } from '../components/ui/AppCard';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { WariatkowoStatus } from '../components/WariatkowoStatus';
import { DASHBOARD_COPY } from '../content/dashboard';
import { LOADING_COPY } from '../content/loading';
import { WARIATKOWO_STATUSES } from '../content/statuses';
import { useShopping } from '../hooks/useShopping';
import { useTasks } from '../hooks/useTasks';
import { useVisitGreeting } from '../hooks/useVisitGreeting';
import { useState } from 'react';

function pickRandomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function formatDueDateLabel(dueDate: string | null): string | null {
  if (!dueDate) {
    return null;
  }

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  const dueKey = new Date(dueDate).toISOString().slice(0, 10);
  if (dueKey === todayKey) {
    return 'Dzisiaj';
  }

  if (dueKey === tomorrowKey) {
    return 'Jutro';
  }

  if (dueKey < todayKey) {
    return 'Po terminie';
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(dueDate));
}

export function DashboardPage() {
  const greeting = useVisitGreeting({ recordVisit: false });
  const { tasks, loadState: tasksLoadState, error: tasksError, refresh: refreshTasks } = useTasks();
  const { items, loadState: shoppingLoadState, error: shoppingError, refresh: refreshShopping } = useShopping();
  const [statusText] = useState(() => pickRandomItem(WARIATKOWO_STATUSES));

  const incompleteTasks = tasks.filter((task) => !task.completed);
  const uncheckedShopping = items.filter((item) => !item.checked);
  const taskPreview = incompleteTasks.slice(0, 3);
  const shoppingPreview = uncheckedShopping.slice(0, 5);

  const tasksCountLabel = `${incompleteTasks.length} ${incompleteTasks.length === 1 ? 'rzecz do zrobienia' : 'rzeczy do zrobienia'}`;
  const shoppingCountLabel = `${uncheckedShopping.length} ${uncheckedShopping.length === 1 ? 'rzecz do kupienia' : 'rzeczy do kupienia'}`;

  return (
    <div className="dashboard-page__surface">
      <PageHeader
        eyebrow={greeting.greeting}
        title={DASHBOARD_COPY.heading}
        description="Mały przegląd domu super miśków. "
      />

      <div className="dashboard-grid">
        <AppCard className="dashboard-card dashboard-card--tasks">
          <SectionHeader
            title={DASHBOARD_COPY.taskCardTitle}
            description={tasksCountLabel}
            actions={
              <Link className="app-link-button" to="/zadania">
                {DASHBOARD_COPY.tasksLink}
              </Link>
            }
          />

          {tasksLoadState === 'loading' ? <LoadingState label={LOADING_COPY.tasks} /> : null}
          {tasksLoadState === 'error' ? (
            <ErrorState
              description={tasksError ?? 'Nie udało się pobrać zadań.'}
              onRetry={refreshTasks}
              title="Nie udało się pobrać zadań."
            />
          ) : null}
          {tasksLoadState === 'ready' && incompleteTasks.length === 0 ? (
            <EmptyState description={DASHBOARD_COPY.tasksEmpty} title="Nic do roboty. Podejrzane." />
          ) : null}
          {tasksLoadState === 'ready' && taskPreview.length > 0 ? (
            <ul className="dashboard-preview-list" aria-label="Podgląd zadań">
              {taskPreview.map((task) => {
                const dueLabel = formatDueDateLabel(task.dueDate);
                return (
                  <li className="dashboard-preview-list__item" key={task.id}>
                    <div>
                      <p className="dashboard-preview-list__title">{task.title}</p>
                      {task.notes ? <p className="dashboard-preview-list__meta">{task.notes}</p> : null}
                    </div>
                    {dueLabel ? <span className="dashboard-preview-list__badge">{dueLabel}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </AppCard>

        <AppCard className="dashboard-card dashboard-card--shopping">
          <SectionHeader
            title={DASHBOARD_COPY.shoppingCardTitle}
            description={shoppingCountLabel}
            actions={
              <Link className="app-link-button" to="/zakupy">
                {DASHBOARD_COPY.shoppingLink}
              </Link>
            }
          />

          {shoppingLoadState === 'loading' ? <LoadingState label={LOADING_COPY.shopping} /> : null}
          {shoppingLoadState === 'error' ? (
            <ErrorState
              description={shoppingError ?? 'Nie udało się pobrać zakupów.'}
              onRetry={refreshShopping}
              title="Nie udało się pobrać zakupów."
            />
          ) : null}
          {shoppingLoadState === 'ready' && uncheckedShopping.length === 0 ? (
            <EmptyState description={DASHBOARD_COPY.shoppingEmpty} title="Lista pusta." />
          ) : null}
          {shoppingLoadState === 'ready' && shoppingPreview.length > 0 ? (
            <ul className="dashboard-preview-list" aria-label="Podgląd zakupów">
              {shoppingPreview.map((item) => (
                <li className="dashboard-preview-list__item" key={item.id}>
                  <div>
                    <p className="dashboard-preview-list__title">{item.name}</p>
                    {item.quantity || item.category ? (
                      <p className="dashboard-preview-list__meta">
                        {[item.quantity, item.category].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <span className="dashboard-preview-list__badge">Do kupienia</span>
                </li>
              ))}
            </ul>
          ) : null}
        </AppCard>

        <AppCard className="dashboard-card dashboard-card--status">
          <SectionHeader title={DASHBOARD_COPY.statusCardTitle} description="Coś między spokojem a kontrolowanym bałaganem." />
          <WariatkowoStatus status={statusText} />
        </AppCard>
      </div>
    </div>
  );
}
