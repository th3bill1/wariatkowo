import { FormEvent, useMemo, useState } from 'react';
import { AppCard } from '../components/ui/AppCard';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TASKS_COPY } from '../content/tasks';
import { LOADING_COPY } from '../content/loading';
import { formatPolishDateLabel } from '../utils/dates';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../../shared/models';

type TaskFormState = {
  title: string;
  notes: string;
  dueDate: string;
};

const EMPTY_FORM: TaskFormState = {
  title: '',
  notes: '',
  dueDate: '',
};

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
  const [form, setForm] = useState<TaskFormState>(initialValue ?? EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <form
      className="task-form"
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
          await onSubmit(form);
          setForm(initialValue ?? EMPTY_FORM);
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać zadania.');
        } finally {
          setIsSaving(false);
        }
      }}
    >
      <label className="field">
        <span className="field__label">{TASKS_COPY.titleLabel}</span>
        <input
          className="field__input"
          maxLength={180}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder="Odkurzyć salon"
          required
          value={form.title}
        />
      </label>

      <label className="field">
        <span className="field__label">{TASKS_COPY.notesLabel}</span>
        <textarea
          className="field__input field__input--textarea"
          maxLength={1500}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Jeśli trzeba, zostaw krótką notatkę."
          value={form.notes}
        />
      </label>

      <label className="field">
        <span className="field__label">{TASKS_COPY.dueDateLabel}</span>
        <input
          className="field__input"
          onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
          type="date"
          value={form.dueDate}
        />
      </label>

      {error ? <p className="form-message form-message--error">{error}</p> : null}

      <div className="task-form__actions">
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? 'Zapisywanie...' : submitLabel}
        </button>
        {onCancel ? (
          <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">
            {TASKS_COPY.cancelButton}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEdit,
  onCancelDelete,
  deletePending,
  editing,
}: {
  task: Task;
  onToggle: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onSaveEdit: (task: Task, value: TaskFormState) => Promise<void>;
  onCancelEdit: () => void;
  onCancelDelete: () => void;
  deletePending: boolean;
  editing: boolean;
}) {
  const dueLabel = formatPolishDateLabel(task.dueDate);
  const initialForm = {
    title: task.title,
    notes: task.notes ?? '',
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
  };

  return (
    <li className={['task-row', task.completed ? 'task-row--completed' : ''].join(' ')}>
      <div className="task-row__main">
        <label className="task-row__check">
          <input
            aria-label={task.completed ? 'Oznacz jako do zrobienia' : 'Oznacz jako zrobione'}
            checked={task.completed}
            onChange={() => void onToggle(task)}
            type="checkbox"
          />
          <span className="task-row__checkmark" aria-hidden="true" />
        </label>

        <div className="task-row__copy">
          <div className="task-row__title-line">
            <p className="task-row__title">{task.title}</p>
            {dueLabel ? <span className="task-row__badge">{dueLabel}</span> : null}
          </div>
          {task.notes ? <p className="task-row__notes">{task.notes}</p> : null}
        </div>
      </div>

      <div className="task-row__actions">
        <button className="ghost-button" onClick={() => onEdit(task)} type="button">
          {TASKS_COPY.editButton}
        </button>
        {deletePending ? (
          <>
            <button className="ghost-button" onClick={onCancelDelete} type="button">
              {TASKS_COPY.cancelButton}
            </button>
            <button className="ghost-button ghost-button--danger" onClick={() => onDelete(task)} type="button">
              Usuń teraz
            </button>
          </>
        ) : (
          <button className="ghost-button ghost-button--danger" onClick={() => onDelete(task)} type="button">
            {TASKS_COPY.deleteButton}
          </button>
        )}
      </div>

      {editing ? (
        <div className="task-row__editor">
          <TaskComposer
            initialValue={initialForm}
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
  const { tasks, loadState, error, refresh, createTask, updateTask, removeTask } = useTasks();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const todoTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.completed), [tasks]);

  const handleCreate = async (value: TaskFormState) => {
    setActionError(null);

    try {
      await createTask({
        title: value.title,
        notes: value.notes.trim() ? value.notes : null,
        dueDate: value.dueDate ? value.dueDate : null,
      });
      setComposerOpen(false);
    } catch (createError) {
      setActionError(createError instanceof Error ? createError.message : 'Nie udało się dodać zadania.');
      throw createError;
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setPendingDeleteId(null);
  };

  const handleDelete = async (task: Task) => {
    setActionError(null);

    if (pendingDeleteId !== task.id) {
      setPendingDeleteId(task.id);
      return;
    }

    try {
      await removeTask(task.id);
      setPendingDeleteId(null);
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć zadania.');
      setPendingDeleteId(null);
    }
  };

  const handleSaveEdit = async (task: Task, value: TaskFormState) => {
    setActionError(null);

    try {
      await updateTask(task.id, {
        title: value.title,
        notes: value.notes.trim() ? value.notes : null,
        dueDate: value.dueDate ? value.dueDate : null,
      });
      setEditingTaskId(null);
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać zadania.');
      throw saveError;
    }
  };

  const handleToggle = async (task: Task) => {
    setActionError(null);

    try {
      await updateTask(task.id, { completed: !task.completed });
    } catch (toggleError) {
      setActionError(toggleError instanceof Error ? toggleError.message : 'Nie udało się zmienić stanu zadania.');
    }
  };

  return (
    <div className="content-stack">
      <PageHeader
        eyebrow="Domowy panel"
        title={TASKS_COPY.heading}
        description="Szybka lista spraw do ogarnięcia, bez zbędnego patosu."
        actions={
          <button className="primary-button" onClick={() => setComposerOpen((current) => !current)} type="button">
            {TASKS_COPY.addButton}
          </button>
        }
      />

      {composerOpen ? (
        <AppCard>
          <SectionHeader title="Nowe zadanie" description="Krótko i bez kombinowania." />
          <TaskComposer onCancel={() => setComposerOpen(false)} onSubmit={handleCreate} submitLabel="Dodaj" />
        </AppCard>
      ) : null}

      {actionError ? <ErrorState description={actionError} title="Nie udało się wykonać zmiany." /> : null}

      {loadState === 'loading' ? <LoadingState label={LOADING_COPY.tasks} /> : null}
      {loadState === 'error' ? (
        <ErrorState description={error ?? 'Nie udało się pobrać zadań.'} onRetry={refresh} title="Nie udało się pobrać zadań." />
      ) : null}

      {loadState === 'ready' && tasks.length === 0 ? (
        <AppCard>
          <EmptyState
            action={
              <button className="primary-button" onClick={() => setComposerOpen(true)} type="button">
                {TASKS_COPY.addButton}
              </button>
            }
            description={TASKS_COPY.emptyDescription}
            title={TASKS_COPY.emptyTitle}
          />
        </AppCard>
      ) : null}

      {loadState === 'ready' && tasks.length > 0 ? (
        <div className="tasks-layout">
          <AppCard>
            <SectionHeader title={TASKS_COPY.todoSection} description={`${todoTasks.length} aktywnych zadań`} />
            {todoTasks.length === 0 ? <EmptyState description="Wszystko odhaczone. Nietypowo spokojnie." title="Brak otwartych zadań." /> : null}
            {todoTasks.length > 0 ? (
              <ul className="task-list">
                {todoTasks.map((task) => (
                  <TaskRow
                    editing={editingTaskId === task.id}
                    deletePending={pendingDeleteId === task.id}
                    key={task.id}
                    onCancelEdit={() => setEditingTaskId(null)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onSaveEdit={handleSaveEdit}
                    onToggle={handleToggle}
                    task={task}
                  />
                ))}
              </ul>
            ) : null}
          </AppCard>

          {completedTasks.length > 0 ? (
            <AppCard>
              <SectionHeader title={TASKS_COPY.completedSection} description={`${completedTasks.length} ukończonych zadań`} />
              <ul className="task-list task-list--quiet">
                {completedTasks.map((task) => (
                  <TaskRow
                    editing={editingTaskId === task.id}
                    deletePending={pendingDeleteId === task.id}
                    key={task.id}
                    onCancelEdit={() => setEditingTaskId(null)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onSaveEdit={handleSaveEdit}
                    onToggle={handleToggle}
                    task={task}
                  />
                ))}
              </ul>
            </AppCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
