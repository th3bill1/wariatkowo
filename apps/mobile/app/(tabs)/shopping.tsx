import { router, type Href } from "expo-router";
import {
  Check,
  Edit3,
  History,
  ShoppingBasket,
  Trash2,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type {
  CreateShoppingItemInput,
  ShoppingItem,
  ShoppingProduct,
} from "../../../../shared/models";
import { SHOPPING_CATEGORIES } from "../../../../shared/shopping";
import { useAuth } from "../../src/AuthProvider";
import { cached } from "../../src/cache";
import { SelectField } from "../../src/formControls";
import { ShoppingQuickAdd } from "../../src/ShoppingQuickAdd";
import { colors } from "../../src/theme";
import { useForegroundRefresh } from "../../src/useForegroundRefresh";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SectionHeader,
  State,
  s,
} from "../../src/ui";

type ShoppingFormValue = { name: string; quantity: string; category: string };

function sortItems(items: ShoppingItem[]) {
  return [...items].sort((first, second) => {
    if (first.checked !== second.checked)
      return Number(first.checked) - Number(second.checked);
    if (first.sortOrder !== second.sortOrder)
      return first.sortOrder - second.sortOrder;
    return Date.parse(first.createdAt) - Date.parse(second.createdAt);
  });
}

function EditForm({
  item,
  onCancel,
  onSave,
}: {
  item: ShoppingItem;
  onCancel(): void;
  onSave(value: ShoppingFormValue): Promise<void>;
}) {
  const [value, setValue] = useState<ShoppingFormValue>({
    name: item.name,
    quantity: item.quantity ?? "",
    category: item.category ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={styles.form}>
      <Field
        label="Nazwa"
        maxLength={180}
        onChangeText={(name) => setValue((current) => ({ ...current, name }))}
        value={value.name}
      />
      <Field
        label="Ilość"
        maxLength={60}
        onChangeText={(quantity) =>
          setValue((current) => ({ ...current, quantity }))
        }
        value={value.quantity}
      />
      <SelectField
        label="Kategoria"
        onChange={(category) =>
          setValue((current) => ({ ...current, category }))
        }
        options={[
          { value: "", label: "Bez kategorii" },
          ...SHOPPING_CATEGORIES.map((category) => ({
            value: category,
            label: category,
          })),
        ]}
        value={value.category}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
      <View style={s.wrap}>
        <Button
          disabled={saving || !value.name.trim()}
          onPress={() => {
            setSaving(true);
            setError(null);
            void onSave(value)
              .catch((reason) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Nie udało się zapisać.",
                ),
              )
              .finally(() => setSaving(false));
          }}
          title={saving ? "Zapisywanie…" : "Zapisz"}
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

function ShoppingRow({
  item,
  editing,
  onToggle,
  onEdit,
  onDelete,
  onCancelEdit,
  onSave,
}: {
  item: ShoppingItem;
  editing: boolean;
  onToggle(item: ShoppingItem): void;
  onEdit(item: ShoppingItem): void;
  onDelete(item: ShoppingItem): void;
  onCancelEdit(): void;
  onSave(item: ShoppingItem, value: ShoppingFormValue): Promise<void>;
}) {
  return (
    <View style={[s.listRow, item.checked && styles.checked]}>
      <View style={styles.itemMain}>
        <Pressable
          accessibilityLabel={
            item.checked ? "Oznacz jako do kupienia" : "Oznacz jako kupione"
          }
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
          onPress={() => onToggle(item)}
          style={({ pressed }) => [
            styles.check,
            item.checked && styles.checkDone,
            pressed && s.pressed,
          ]}
        >
          {item.checked ? (
            <Check color={colors.white} size={23} strokeWidth={3} />
          ) : null}
        </Pressable>
        <View style={s.grow}>
          <View style={s.spaceBetween}>
            <Text style={[s.label, item.checked && styles.strike]}>
              {item.name}
            </Text>
            {item.quantity ? (
              <Text style={s.badge}>{item.quantity}</Text>
            ) : null}
          </View>
          {item.category ? <Text style={s.meta}>{item.category}</Text> : null}
        </View>
      </View>
      <View style={s.wrap}>
        <Button
          compact
          Icon={Edit3}
          onPress={() => onEdit(item)}
          title="Edytuj"
          variant="ghost"
        />
        <Button
          compact
          Icon={Trash2}
          onPress={() => onDelete(item)}
          title="Usuń"
          variant="danger"
        />
      </View>
      {editing ? (
        <View style={styles.editor}>
          <EditForm
            item={item}
            onCancel={onCancelEdit}
            onSave={(value) => onSave(item, value)}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function ShoppingScreen() {
  const { api } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [common, setCommon] = useState<ShoppingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const result = await cached("shopping", () => api.shopping.list());
        setItems(sortItems(result.data));
        setStale(result.stale);
        setError(null);
        if (!result.stale) {
          void api.shopping
            .suggestions("", true, 8)
            .then(setCommon)
            .catch(() => setCommon([]));
        }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Nie udało się pobrać zakupów.",
        );
      } finally {
        setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => void load(), [load]);
  useForegroundRefresh(() => void load(false));

  const todo = useMemo(() => items.filter((item) => !item.checked), [items]);
  const bought = useMemo(() => items.filter((item) => item.checked), [items]);
  const add = async (input: CreateShoppingItemInput) => {
    const created = await api.shopping.create(input);
    setItems((current) => sortItems([created, ...current]));
    void api.shopping
      .suggestions("", true, 8)
      .then(setCommon)
      .catch(() => undefined);
    return created;
  };
  const toggle = async (item: ShoppingItem) => {
    try {
      const updated = await api.shopping.update(item.id, {
        checked: !item.checked,
      });
      setItems((current) =>
        sortItems(
          current.map((value) => (value.id === item.id ? updated : value)),
        ),
      );
    } catch (reason) {
      Alert.alert(
        "Nie udało się zmienić produktu",
        reason instanceof Error ? reason.message : "",
      );
    }
  };
  const remove = (item: ShoppingItem) => {
    Alert.alert("Usunąć produkt?", item.name, [
      { text: "Anuluj", style: "cancel" },
      {
        text: "Usuń",
        style: "destructive",
        onPress: () =>
          void api.shopping
            .remove(item.id)
            .then(() =>
              setItems((current) =>
                current.filter((value) => value.id !== item.id),
              ),
            )
            .catch((reason) =>
              Alert.alert("Nie udało się usunąć", reason.message),
            ),
      },
    ]);
  };
  const row = (item: ShoppingItem) => (
    <ShoppingRow
      editing={editingId === item.id}
      item={item}
      key={item.id}
      onCancelEdit={() => setEditingId(null)}
      onDelete={remove}
      onEdit={(value) => setEditingId(value.id)}
      onSave={async (value, form) => {
        const updated = await api.shopping.update(value.id, {
          name: form.name.trim(),
          quantity: form.quantity.trim() || null,
          category: form.category || null,
        });
        setItems((current) =>
          sortItems(
            current.map((currentItem) =>
              currentItem.id === value.id ? updated : currentItem,
            ),
          ),
        );
        setEditingId(null);
      }}
      onToggle={(value) => void toggle(value)}
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
          <View style={s.wrap}>
            <Button
              Icon={ShoppingBasket}
              onPress={() => router.push("/shopping/shop-mode" as Href)}
              title="Tryb sklepowy"
            />
            <Button
              Icon={History}
              onPress={() => router.push("/shopping/products" as Href)}
              title="Historia produktów"
              variant="secondary"
            />
          </View>
        }
        description="Może o niczym nie zapomnimy."
        eyebrow="Lista pod ręką"
        title="Zakupy"
      />
      <Card>
        <SectionHeader
          description="Wpisz nazwę lub wybierz podpowiedź."
          title="Szybkie dodanie"
        />
        <ShoppingQuickAdd items={items} onAdd={add} />
        {common.length ? (
          <View style={styles.common}>
            <Text style={s.label}>Często kupowane</Text>
            <View style={s.chips}>
              {common.map((product) => (
                <Button
                  compact
                  key={product.id}
                  onPress={() =>
                    void add({
                      name: product.name,
                      category: product.defaultCategory,
                      quantity: null,
                    })
                  }
                  title={`+ ${product.name}`}
                  variant="ghost"
                />
              ))}
            </View>
          </View>
        ) : null}
      </Card>
      {stale ? (
        <Text style={s.error}>Tryb offline — pokazujemy ostatnią listę.</Text>
      ) : null}
      <State
        error={error}
        loading={loading && !items.length}
        loadingLabel="Ładujemy listę zakupów."
        onRetry={() => void load()}
      />
      {!loading && !items.length ? (
        <Card>
          <EmptyState
            description="To niemożliwe."
            title="Lista zakupów jest pusta."
          />
        </Card>
      ) : null}
      {items.length ? (
        <Card>
          <SectionHeader
            description={`${todo.length} pozycji`}
            title="Do kupienia"
          />
          {todo.length ? (
            todo.map(row)
          ) : (
            <EmptyState
              description="Można wracać do Wariatkowa."
              title="Wszystko kupione"
            />
          )}
        </Card>
      ) : null}
      {bought.length ? (
        <Card>
          <SectionHeader
            action={
              <Button
                compact
                onPress={() =>
                  Alert.alert(
                    "Usunąć wszystkie kupione?",
                    `${bought.length} pozycji`,
                    [
                      { text: "Anuluj", style: "cancel" },
                      {
                        text: "Usuń",
                        style: "destructive",
                        onPress: () =>
                          void api.shopping
                            .clearCompleted()
                            .then(() =>
                              setItems((current) =>
                                current.filter((item) => !item.checked),
                              ),
                            )
                            .catch((reason) =>
                              Alert.alert(
                                "Nie udało się usunąć",
                                reason.message,
                              ),
                            ),
                      },
                    ],
                  )
                }
                title="Usuń kupione"
                variant="secondary"
              />
            }
            description={`${bought.length} kupionych pozycji`}
            title="Kupione"
          />
          {bought.map(row)}
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  itemMain: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  check: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.purple, borderColor: colors.purple },
  checked: { opacity: 0.72 },
  strike: { textDecorationLine: "line-through" },
  editor: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  common: { gap: 9, paddingTop: 4 },
});
