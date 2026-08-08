import { FormEvent, useMemo, useState } from "react";
import { Repeat2, UserRound, UsersRound } from "lucide-react";
import type { Task, TaskAssignment, TaskRecurrence } from "../../shared/models";
import { useAuth } from "../auth/AuthContext";
import { AppCard } from "../components/ui/AppCard";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/SectionHeader";
import { LOADING_COPY } from "../content/loading";
import { TASKS_COPY } from "../content/tasks";
import { useTasks } from "../hooks/useTasks";
import { formatPolishDateLabel } from "../utils/dates";

type Filter = "all" | "mine" | "both";
type RecurrenceChoice =
  "none" | "day:1" | "week:1" | "week:2" | "month:1" | "custom";
type TaskFormState = {
  title: string;
  notes: string;
  dueDate: string;
  assignment: TaskAssignment;
  recurrenceChoice: RecurrenceChoice;
  customDays: string;
};
const EMPTY_FORM: TaskFormState = {
  title: "",
  notes: "",
  dueDate: "",
  assignment: "anyone",
  recurrenceChoice: "none",
  customDays: "3",
};
const ASSIGNMENT_LABELS: Record<TaskAssignment, string> = {
  anyone: "Dla kogokolwiek",
  misiek: "Misiek",
  miska: "Miśka",
  both: "Dla nas",
};

function recurrenceFromForm(form: TaskFormState): TaskRecurrence | null {
  if (form.recurrenceChoice === "none") return null;
  if (form.recurrenceChoice === "custom")
    return { unit: "day", interval: Number(form.customDays) };
  const [unit, interval] = form.recurrenceChoice.split(":");
  return { unit: unit as TaskRecurrence["unit"], interval: Number(interval) };
}
function recurrenceChoice(
  task: Task,
): Pick<TaskFormState, "recurrenceChoice" | "customDays"> {
  const rule = task.recurrence;
  if (!rule) return { recurrenceChoice: "none", customDays: "3" };
  const key = rule.unit + ":" + rule.interval;
  if (
    key === "day:1" ||
    key === "week:1" ||
    key === "week:2" ||
    key === "month:1"
  )
    return { recurrenceChoice: key, customDays: "3" };
  return { recurrenceChoice: "custom", customDays: String(rule.interval) };
}
function recurrenceLabel(rule: TaskRecurrence | null): string | null {
  if (!rule) return null;
  if (rule.unit === "day" && rule.interval === 1) return "Codziennie";
  if (rule.unit === "week" && rule.interval === 1) return "Co tydzień";
  if (rule.unit === "week" && rule.interval === 2) return "Co 2 tygodnie";
  if (rule.unit === "month" && rule.interval === 1) return "Co miesiąc";
  return "Co " + rule.interval + " dni";
}
function TaskComposer({
  initialValue,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  initialValue?: TaskFormState;
  onCancel?: () => void;
  onSubmit: (value: TaskFormState) => Promise<void>;
  submitLabel: string;
}) {
  const [form, setForm] = useState(initialValue ?? EMPTY_FORM);
  const [error, setError] = useState<string | null>(null),
    [saving, setSaving] = useState(false);
  return (
    <form
      className="task-form"
      onSubmit={async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setSaving(true);
        try {
          await onSubmit(form);
          setForm(initialValue ?? EMPTY_FORM);
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Nie udało się zapisać zadania.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="field">
        <span className="field__label">{TASKS_COPY.titleLabel}</span>
        <input
          className="field__input"
          maxLength={180}
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">{TASKS_COPY.notesLabel}</span>
        <textarea
          className="field__input field__input--textarea"
          maxLength={1500}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
      </label>
      <div className="task-form__grid">
        <label className="field">
          <span className="field__label">{TASKS_COPY.dueDateLabel}</span>
          <input
            className="field__input"
            type="date"
            required={form.recurrenceChoice !== "none"}
            value={form.dueDate}
            onChange={(event) =>
              setForm({ ...form, dueDate: event.target.value })
            }
          />
        </label>
        <label className="field">
          <span className="field__label">Powtarzanie</span>
          <select
            className="field__input"
            value={form.recurrenceChoice}
            onChange={(event) =>
              setForm({
                ...form,
                recurrenceChoice: event.target.value as RecurrenceChoice,
              })
            }
          >
            <option value="none">Nie powtarzaj</option>
            <option value="day:1">Codziennie</option>
            <option value="week:1">Co tydzień</option>
            <option value="week:2">Co 2 tygodnie</option>
            <option value="month:1">Co miesiąc</option>
            <option value="custom">Co X dni</option>
          </select>
        </label>
      </div>
      {form.recurrenceChoice === "custom" ? (
        <label className="field">
          <span className="field__label">Co ile dni?</span>
          <input
            className="field__input"
            min={1}
            max={365}
            required
            type="number"
            value={form.customDays}
            onChange={(event) =>
              setForm({ ...form, customDays: event.target.value })
            }
          />
        </label>
      ) : null}
      <fieldset className="assignment-picker">
        <legend>Dla kogo?</legend>
        {(["anyone", "misiek", "miska", "both"] as TaskAssignment[]).map(
          (value) => (
            <label
              className={
                form.assignment === value
                  ? "assignment-choice assignment-choice--active"
                  : "assignment-choice"
              }
              key={value}
            >
              <input
                checked={form.assignment === value}
                name="assignment"
                onChange={() => setForm({ ...form, assignment: value })}
                type="radio"
              />
              {value === "both" ? <UsersRound /> : <UserRound />}
              <span>
                {value === "anyone" ? "Ktokolwiek" : ASSIGNMENT_LABELS[value]}
              </span>
            </label>
          ),
        )}
      </fieldset>
      {error ? (
        <p className="form-message form-message--error">{error}</p>
      ) : null}
      <div className="task-form__actions">
        <button className="primary-button" disabled={saving} type="submit">
          {saving ? "Zapisywanie…" : submitLabel}
        </button>
        {onCancel ? (
          <button
            className="secondary-button"
            disabled={saving}
            onClick={onCancel}
            type="button"
          >
            {TASKS_COPY.cancelButton}
          </button>
        ) : null}
      </div>
    </form>
  );
}
function TaskRow({
  task,
  editing,
  deletePending,
  onToggle,
  onEdit,
  onDelete,
  onCancelEdit,
  onCancelDelete,
  onSaveEdit,
}: {
  task: Task;
  editing: boolean;
  deletePending: boolean;
  onToggle: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onCancelEdit: () => void;
  onCancelDelete: () => void;
  onSaveEdit: (task: Task, value: TaskFormState) => Promise<void>;
}) {
  const initial = {
    title: task.title,
    notes: task.notes ?? "",
    dueDate: task.dueDate?.slice(0, 10) ?? "",
    assignment: task.assignment,
    ...recurrenceChoice(task),
  };
  const repeat = recurrenceLabel(task.recurrence);
  return (
    <li className={"task-row " + (task.completed ? "task-row--completed" : "")}>
      <div className="task-row__main">
        <label className="task-row__check">
          <input
            aria-label={
              task.completed
                ? "Oznacz jako do zrobienia"
                : "Oznacz jako zrobione"
            }
            checked={task.completed}
            onChange={() => void onToggle(task)}
            type="checkbox"
          />
          <span className="task-row__checkmark" aria-hidden="true" />
        </label>
        <div className="task-row__copy">
          <div className="task-row__title-line">
            <p className="task-row__title">{task.title}</p>
            {task.dueDate ? (
              <span className="task-row__badge">
                {formatPolishDateLabel(task.dueDate)}
              </span>
            ) : null}
          </div>
          <div className="task-row__meta">
            <span>{ASSIGNMENT_LABELS[task.assignment]}</span>
            {repeat ? (
              <span>
                <Repeat2 aria-hidden="true" />
                {repeat}
              </span>
            ) : null}
          </div>
          {task.notes ? <p className="task-row__notes">{task.notes}</p> : null}
        </div>
      </div>
      <div className="task-row__actions">
        <button
          className="ghost-button"
          onClick={() => onEdit(task)}
          type="button"
        >
          {TASKS_COPY.editButton}
        </button>
        {deletePending ? (
          <>
            <button
              className="ghost-button"
              onClick={onCancelDelete}
              type="button"
            >
              {TASKS_COPY.cancelButton}
            </button>
            <button
              className="ghost-button ghost-button--danger"
              onClick={() => onDelete(task)}
              type="button"
            >
              Usuń teraz
            </button>
          </>
        ) : (
          <button
            className="ghost-button ghost-button--danger"
            onClick={() => onDelete(task)}
            type="button"
          >
            {TASKS_COPY.deleteButton}
          </button>
        )}
      </div>
      {editing ? (
        <div className="task-row__editor">
          <TaskComposer
            initialValue={initial}
            onCancel={onCancelEdit}
            onSubmit={(value) => onSaveEdit(task, value)}
            submitLabel={TASKS_COPY.saveButton}
          />
        </div>
      ) : null}
    </li>
  );
}
export function TasksPage() {
  const { member } = useAuth();
  const {
    tasks,
    loadState,
    error,
    refresh,
    createTask,
    updateTask,
    removeTask,
  } = useTasks();
  const [composerOpen, setComposerOpen] = useState(false),
    [editingId, setEditingId] = useState<string | null>(null),
    [deleteId, setDeleteId] = useState<string | null>(null),
    [actionError, setActionError] = useState<string | null>(null),
    [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(
    () =>
      tasks.filter(
        (task) =>
          filter === "all" ||
          (filter === "mine" && task.assignment === member?.slug) ||
          (filter === "both" && task.assignment === "both"),
      ),
    [tasks, filter, member],
  );
  const todo = visible.filter((task) => !task.completed),
    completed = visible.filter((task) => task.completed);
  const payload = (value: TaskFormState) => ({
    title: value.title,
    notes: value.notes.trim() || null,
    dueDate: value.dueDate || null,
    assignment: value.assignment,
    recurrence: recurrenceFromForm(value),
  });
  const save = async (task: Task, value: TaskFormState) => {
    await updateTask(task.id, payload(value));
    setEditingId(null);
  };
  const remove = async (task: Task) => {
    if (deleteId !== task.id) {
      setDeleteId(task.id);
      return;
    }
    try {
      await removeTask(task.id);
      setDeleteId(null);
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się usunąć zadania.",
      );
    }
  };
  const toggle = async (task: Task) => {
    try {
      await updateTask(task.id, { completed: !task.completed });
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się zmienić zadania.",
      );
    }
  };
  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      editing={editingId === task.id}
      deletePending={deleteId === task.id}
      onToggle={toggle}
      onEdit={() => {
        setEditingId(task.id);
        setDeleteId(null);
      }}
      onDelete={remove}
      onCancelEdit={() => setEditingId(null)}
      onCancelDelete={() => setDeleteId(null)}
      onSaveEdit={save}
    />
  );
  return (
    <div className="content-stack">
      <PageHeader
        eyebrow={member?.slug === "miska" ? "Panel Miśki" : "Panel Miśka"}
        title={TASKS_COPY.heading}
        description="Sprawy do ogarnięcia."
        actions={
          <button
            className="primary-button"
            onClick={() => setComposerOpen((value) => !value)}
            type="button"
          >
            {TASKS_COPY.addButton}
          </button>
        }
      />
      {composerOpen ? (
        <AppCard>
          <SectionHeader
            title="Nowe zadanie"
            description="Treść miśkozadania."
          />
          <TaskComposer
            onCancel={() => setComposerOpen(false)}
            onSubmit={async (value) => {
              await createTask(payload(value));
              setComposerOpen(false);
            }}
            submitLabel="Dodaj"
          />
        </AppCard>
      ) : null}
      <div className="task-filters" aria-label="Filtry zadań">
        {(
          [
            ["all", "Wszystkie"],
            ["mine", "Moje"],
            ["both", "Dla nas"],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            aria-pressed={filter === value}
            className={
              filter === value
                ? "task-filter task-filter--active"
                : "task-filter"
            }
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {actionError ? (
        <ErrorState
          description={actionError}
          title="Nie udało się wykonać zmiany."
        />
      ) : null}
      {loadState === "loading" ? (
        <LoadingState label={LOADING_COPY.tasks} />
      ) : null}
      {loadState === "error" ? (
        <ErrorState
          description={error ?? "Nie udało się pobrać zadań."}
          onRetry={refresh}
          title="Nie udało się pobrać zadań."
        />
      ) : null}
      {loadState === "ready" && visible.length === 0 ? (
        <AppCard>
          <EmptyState
            description="W tym widoku nic nie czeka."
            title="Spokojnie."
          />
        </AppCard>
      ) : null}
      {loadState === "ready" && visible.length > 0 ? (
        <div className="tasks-layout">
          <AppCard>
            <SectionHeader
              title={TASKS_COPY.todoSection}
              description={todo.length + " aktywnych zadań"}
            />
            {todo.length ? (
              <ul className="task-list">{todo.map(row)}</ul>
            ) : (
              <EmptyState
                description="Wszystko odhaczone."
                title="Brak otwartych zadań."
              />
            )}
          </AppCard>
          {completed.length ? (
            <AppCard>
              <SectionHeader
                title={TASKS_COPY.completedSection}
                description={completed.length + " ukończonych zadań"}
              />
              <ul className="task-list task-list--quiet">
                {completed.map(row)}
              </ul>
            </AppCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
