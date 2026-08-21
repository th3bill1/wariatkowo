import {
  Check,
  Edit3,
  Plus,
  Repeat2,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  TASK_ASSIGNMENT_LABELS,
  taskRecurrenceLabel,
} from "../../../../shared/labels";
import type {
  Task,
  TaskAssignment,
  TaskRecurrence,
  CreateTaskInput,
} from "../../../../shared/models";
import { useAuth } from "../../src/AuthProvider";
import { cached } from "../../src/cache";
import { formatPolishDate } from "../../src/date";
import { DateField, SelectField } from "../../src/formControls";
import { colors, fonts } from "../../src/theme";
import { useForegroundRefresh } from "../../src/useForegroundRefresh";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  PageHeader,
  SectionHeader,
  State,
  s,
} from "../../src/ui";

type Filter = "all" | "mine" | "both";
type RecurrenceChoice =
  "none" | "day:1" | "week:1" | "week:2" | "month:1" | "custom";
type TaskFormValue = {
  title: string;
  notes: string;
  dueDate: string;
  assignment: TaskAssignment;
  recurrenceChoice: RecurrenceChoice;
  customDays: string;
};

const emptyForm = (): TaskFormValue => ({
  title: "",
  notes: "",
  dueDate: "",
  assignment: "anyone",
  recurrenceChoice: "none",
  customDays: "3",
});

function recurrenceFromForm(form: TaskFormValue): TaskRecurrence | null {
  if (form.recurrenceChoice === "none") return null;
  if (form.recurrenceChoice === "custom") {
    return { unit: "day", interval: Number(form.customDays) };
  }
  const [unit, interval] = form.recurrenceChoice.split(":");
  return { unit: unit as TaskRecurrence["unit"], interval: Number(interval) };
}

function recurrenceForTask(
  task: Task,
): Pick<TaskFormValue, "recurrenceChoice" | "customDays"> {
  if (!task.recurrence) return { recurrenceChoice: "none", customDays: "3" };
  const key = `${task.recurrence.unit}:${task.recurrence.interval}`;
  if (["day:1", "week:1", "week:2", "month:1"].includes(key)) {
    return { recurrenceChoice: key as RecurrenceChoice, customDays: "3" };
  }
  return {
    recurrenceChoice: "custom",
    customDays: String(task.recurrence.interval),
  };
}

function taskForm(task?: Task): TaskFormValue {
  if (!task) return emptyForm();
  return {
    title: task.title,
    notes: task.notes ?? "",
    dueDate: task.dueDate?.slice(0, 10) ?? "",
    assignment: task.assignment,
    ...recurrenceForTask(task),
  };
}

function sortTasks(items: Task[]) {
  return [...items].sort((first, second) => {
    if (first.completed !== second.completed)
      return Number(first.completed) - Number(second.completed);
    const firstDue = first.dueDate
      ? Date.parse(first.dueDate)
      : Number.POSITIVE_INFINITY;
    const secondDue = second.dueDate
      ? Date.parse(second.dueDate)
      : Number.POSITIVE_INFINITY;
    if (firstDue !== secondDue) return firstDue - secondDue;
    if (first.sortOrder !== second.sortOrder)
      return first.sortOrder - second.sortOrder;
    return Date.parse(first.createdAt) - Date.parse(second.createdAt);
  });
}

function TaskComposer({
  task,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  task?: Task;
  submitLabel: string;
  onCancel(): void;
  onSubmit(value: TaskFormValue): Promise<void>;
}) {
  const [form, setForm] = useState(() => taskForm(task));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!form.title.trim()) {
      setError("Podaj nazwę zadania.");
      return;
    }
    if (form.recurrenceChoice !== "none" && !form.dueDate) {
      setError("Powtarzalne zadanie musi mieć termin.");
      return;
    }
    if (
      form.recurrenceChoice === "custom" &&
      (!Number.isInteger(Number(form.customDays)) ||
        Number(form.customDays) < 1)
    ) {
      setError("Liczba dni musi być dodatnią liczbą całkowitą.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się zapisać zadania.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.form}>
      <Field
        label="Nazwa *"
        maxLength={180}
        onChangeText={(title) => setForm((value) => ({ ...value, title }))}
        placeholder="Co trzeba ogarnąć?"
        value={form.title}
      />
      <Field
        label="Notatka"
        maxLength={1500}
        multiline
        onChangeText={(notes) => setForm((value) => ({ ...value, notes }))}
        value={form.notes}
      />
      <DateField
        label="Termin"
        onChange={(dueDate) => setForm((value) => ({ ...value, dueDate }))}
        value={form.dueDate}
      />
      <SelectField
        label="Powtarzanie"
        onChange={(recurrenceChoice) =>
          setForm((value) => ({ ...value, recurrenceChoice }))
        }
        options={[
          { value: "none", label: "Nie powtarzaj" },
          { value: "day:1", label: "Codziennie" },
          { value: "week:1", label: "Co tydzień" },
          { value: "week:2", label: "Co 2 tygodnie" },
          { value: "month:1", label: "Co miesiąc" },
          { value: "custom", label: "Co X dni" },
        ]}
        value={form.recurrenceChoice}
      />
      {form.recurrenceChoice === "custom" ? (
        <Field
          keyboardType="number-pad"
          label="Co ile dni?"
          maxLength={3}
          onChangeText={(customDays) =>
            setForm((value) => ({ ...value, customDays }))
          }
          value={form.customDays}
        />
      ) : null}
      <View style={s.field}>
        <Text style={s.fieldLabel}>Dla kogo?</Text>
        <View style={s.chips}>
          {(["anyone", "misiek", "miska", "both"] as const).map(
            (assignment) => (
              <Chip
                Icon={assignment === "both" ? UsersRound : UserRound}
                key={assignment}
                label={
                  assignment === "anyone"
                    ? "Ktokolwiek"
                    : TASK_ASSIGNMENT_LABELS[assignment]
                }
                onPress={() => setForm((value) => ({ ...value, assignment }))}
                selected={form.assignment === assignment}
              />
            ),
          )}
        </View>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <View style={s.wrap}>
        <Button
          disabled={saving}
          onPress={() => void submit()}
          title={saving ? "Zapisywanie…" : submitLabel}
        />
        <Button
          disabled={saving}
          onPress={onCancel}
          title="Anuluj"
          variant="ghost"
        />
      </View>
    </View>
  );
}

function TaskRow({
  task,
  editing,
  onToggle,
  onEdit,
  onDelete,
  onCancelEdit,
  onSave,
}: {
  task: Task;
  editing: boolean;
  onToggle(task: Task): void;
  onEdit(task: Task): void;
  onDelete(task: Task): void;
  onCancelEdit(): void;
  onSave(task: Task, value: TaskFormValue): Promise<void>;
}) {
  const recurrence = taskRecurrenceLabel(task.recurrence);
  return (
    <View style={[s.listRow, task.completed && styles.completed]}>
      <View style={styles.taskMain}>
        <Pressable
          accessibilityLabel={
            task.completed ? "Oznacz jako do zrobienia" : "Oznacz jako zrobione"
          }
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.completed }}
          onPress={() => onToggle(task)}
          style={({ pressed }) => [
            styles.check,
            task.completed && styles.checkDone,
            pressed && s.pressed,
          ]}
        >
          {task.completed ? (
            <Check color={colors.white} size={22} strokeWidth={3} />
          ) : null}
        </Pressable>
        <View style={s.grow}>
          <View style={s.spaceBetween}>
            <Text style={[s.label, task.completed && styles.strike]}>
              {task.title}
            </Text>
            {task.dueDate ? (
              <Text style={s.badge}>{formatPolishDate(task.dueDate)}</Text>
            ) : null}
          </View>
          <View style={styles.metaLine}>
            <Text style={s.meta}>
              {TASK_ASSIGNMENT_LABELS[task.assignment]}
            </Text>
            {recurrence ? (
              <View style={s.row}>
                <Repeat2 color={colors.muted} size={14} />
                <Text style={s.meta}>{recurrence}</Text>
              </View>
            ) : null}
          </View>
          {task.notes ? <Text style={s.body}>{task.notes}</Text> : null}
        </View>
      </View>
      <View style={s.wrap}>
        <Button
          compact
          Icon={Edit3}
          onPress={() => onEdit(task)}
          title="Edytuj"
          variant="ghost"
        />
        <Button
          compact
          Icon={Trash2}
          onPress={() => onDelete(task)}
          title="Usuń"
          variant="danger"
        />
      </View>
      {editing ? (
        <View style={styles.editor}>
          <TaskComposer
            onCancel={onCancelEdit}
            onSubmit={(value) => onSave(task, value)}
            submitLabel="Zapisz"
            task={task}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function TasksScreen() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const { api, member } = useAuth();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const handledAdd = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (add && handledAdd.current !== add) {
      handledAdd.current = add;
      setEditingId(null);
      setComposerOpen(true);
    }
  }, [add]);

  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const result = await cached("tasks", () => api.tasks.list());
        setItems(sortTasks(result.data));
        setStale(result.stale);
        setError(null);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Nie udało się pobrać zadań.",
        );
      } finally {
        setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => void load(), [load]);
  useForegroundRefresh(() => void load(false));

  const payload = (value: TaskFormValue): CreateTaskInput => ({
    title: value.title.trim(),
    notes: value.notes.trim() || null,
    dueDate: value.dueDate || null,
    assignment: value.assignment,
    recurrence: recurrenceFromForm(value),
  });
  const visible = useMemo(
    () =>
      items.filter(
        (task) =>
          filter === "all" ||
          (filter === "mine" && task.assignment === member?.slug) ||
          (filter === "both" && task.assignment === "both"),
      ),
    [filter, items, member],
  );
  const todo = visible.filter((task) => !task.completed);
  const completed = visible.filter((task) => task.completed);
  const toggle = async (task: Task) => {
    try {
      const updated = await api.tasks.update(task.id, {
        completed: !task.completed,
      });
      setItems((current) =>
        sortTasks(
          current.map((item) => (item.id === task.id ? updated : item)),
        ),
      );
      if (!task.completed) await load(false);
    } catch (reason) {
      Alert.alert(
        "Nie udało się zmienić zadania",
        reason instanceof Error ? reason.message : "",
      );
    }
  };
  const remove = (task: Task) => {
    Alert.alert("Usunąć zadanie?", task.title, [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń",
        style: "destructive",
        onPress: () =>
          void api.tasks
            .remove(task.id)
            .then(() =>
              setItems((current) =>
                current.filter((item) => item.id !== task.id),
              ),
            )
            .catch((reason) =>
              Alert.alert("Nie udało się usunąć", reason.message),
            ),
      },
    ]);
  };
  const renderRow = (task: Task) => (
    <TaskRow
      editing={editingId === task.id}
      key={task.id}
      onCancelEdit={() => setEditingId(null)}
      onDelete={remove}
      onEdit={(item) => setEditingId(item.id)}
      onSave={async (item, value) => {
        const updated = await api.tasks.update(item.id, payload(value));
        setItems((current) =>
          sortTasks(
            current.map((taskItem) =>
              taskItem.id === item.id ? updated : taskItem,
            ),
          ),
        );
        setEditingId(null);
      }}
      onToggle={(item) => void toggle(item)}
      task={task}
    />
  );

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
        action={
          <Button
            Icon={Plus}
            onPress={() => setComposerOpen((open) => !open)}
            title="Dodaj zadanie"
          />
        }
        description="Sprawy do ogarnięcia."
        eyebrow={member?.slug === "miska" ? "Panel Miśki" : "Panel Miśka"}
        title="Zadania"
      />
      {composerOpen ? (
        <Card>
          <SectionHeader
            description="Treść miśkozadania."
            title="Nowe zadanie"
          />
          <TaskComposer
            onCancel={() => setComposerOpen(false)}
            onSubmit={async (value) => {
              const created = await api.tasks.create(payload(value));
              setItems((current) => sortTasks([created, ...current]));
              setComposerOpen(false);
            }}
            submitLabel="Dodaj"
          />
        </Card>
      ) : null}
      <View accessibilityLabel="Filtry zadań" style={s.chips}>
        <Chip
          label="Wszystkie"
          onPress={() => setFilter("all")}
          selected={filter === "all"}
        />
        <Chip
          label="Moje"
          onPress={() => setFilter("mine")}
          selected={filter === "mine"}
        />
        <Chip
          label="Dla nas"
          onPress={() => setFilter("both")}
          selected={filter === "both"}
        />
      </View>
      {stale ? (
        <Text style={s.error}>Tryb offline — dane są tylko do odczytu.</Text>
      ) : null}
      <State
        error={error}
        loading={loading && !items.length}
        loadingLabel="Ładujemy zadania."
        onRetry={() => void load()}
      />
      {!loading && !visible.length ? (
        <Card>
          <EmptyState
            description="W tym widoku nic nie czeka."
            title="Spokojnie."
          />
        </Card>
      ) : null}
      {visible.length ? (
        <Card>
          <SectionHeader
            description={`${todo.length} aktywnych zadań`}
            title="Do zrobienia"
          />
          {todo.length ? (
            todo.map(renderRow)
          ) : (
            <EmptyState
              description="Wszystko odhaczone."
              title="Brak otwartych zadań."
            />
          )}
        </Card>
      ) : null}
      {completed.length ? (
        <Card>
          <SectionHeader
            description={`${completed.length} ukończonych zadań`}
            title="Zrobione"
          />
          {completed.map(renderRow)}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { gap: 13 },
  taskMain: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  check: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.purple, borderColor: colors.purple },
  completed: { opacity: 0.72 },
  strike: { textDecorationLine: "line-through" },
  metaLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  editor: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
});
