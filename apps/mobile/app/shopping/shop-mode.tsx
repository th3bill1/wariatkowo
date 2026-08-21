import { router } from "expo-router";
import { Check, ChevronLeft } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type {
  CreateShoppingItemInput,
  ShoppingItem,
} from "../../../../shared/models";
import {
  groupByShoppingCategory,
  SHOPPING_CATEGORIES,
} from "../../../../shared/shopping";
import { useAuth } from "../../src/AuthProvider";
import { cached } from "../../src/cache";
import { ShoppingQuickAdd } from "../../src/ShoppingQuickAdd";
import { colors, fonts } from "../../src/theme";
import { EmptyState, State, s } from "../../src/ui";

export default function ShopModeScreen() {
  const { api } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cached("shopping", () => api.shopping.list());
      setItems(result.data);
      setError(
        result.stale ? "Tryb offline — lista jest tylko do odczytu." : null,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się pobrać zakupów.",
      );
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => void load(), [load]);
  const active = items.filter((item) => !item.checked);
  const bought = items.filter((item) => item.checked);
  const groups = useMemo(
    () => groupByShoppingCategory(active, SHOPPING_CATEGORIES),
    [active],
  );
  const toggle = async (item: ShoppingItem) => {
    try {
      const updated = await api.shopping.update(item.id, {
        checked: !item.checked,
      });
      setItems((current) =>
        current.map((value) => (value.id === item.id ? updated : value)),
      );
    } catch (reason) {
      Alert.alert(
        "Nie udało się odhaczyć produktu",
        reason instanceof Error ? reason.message : "",
      );
    }
  };
  const add = async (input: CreateShoppingItemInput) => {
    const created = await api.shopping.create(input);
    setItems((current) => [created, ...current]);
    return created;
  };
  const itemButton = (item: ShoppingItem) => (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      key={item.id}
      onPress={() => void toggle(item)}
      style={({ pressed }) => [
        styles.item,
        item.checked && styles.itemBought,
        pressed && s.pressed,
      ]}
    >
      <View style={[styles.box, item.checked && styles.boxBought]}>
        {item.checked ? (
          <Check color={colors.white} size={22} strokeWidth={3} />
        ) : null}
      </View>
      <View style={s.grow}>
        <Text style={[styles.itemName, item.checked && styles.strike]}>
          {item.name}
        </Text>
        {item.quantity ? <Text style={s.meta}>{item.quantity}</Text> : null}
      </View>
    </Pressable>
  );
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Wróć do zwykłej listy"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft color={colors.text} size={24} />
          <Text style={styles.headerText}>Zakupy</Text>
        </Pressable>
        <Text style={styles.counter}>{active.length} zostało</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <State
          error={error}
          loading={loading}
          loadingLabel="Pakujemy listę…"
          onRetry={() => void load()}
        />
        {!loading && !active.length ? (
          <View style={styles.done}>
            <Check color={colors.greenDark} size={54} />
            <EmptyState
              description="Można wracać do Wariatkowa."
              title="Wszystko kupione"
            />
          </View>
        ) : null}
        {groups.map(([category, values]) => (
          <View key={category} style={styles.group}>
            <Text style={styles.groupTitle}>{category}</Text>
            {values.map(itemButton)}
          </View>
        ))}
        {bought.length ? (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>Kupione · {bought.length}</Text>
            {bought.map(itemButton)}
          </View>
        ) : null}
        <View style={styles.quickAdd}>
          <ShoppingQuickAdd
            compact
            items={items}
            onAdd={add}
            placeholder="Dodaj produkt"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 60,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 4 },
  headerText: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 18 },
  counter: { color: colors.purple, fontFamily: fonts.extraBold, fontSize: 15 },
  content: { padding: 14, paddingBottom: 34, gap: 18 },
  group: { gap: 8 },
  groupTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 20 },
  item: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 13,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemBought: { opacity: 0.62 },
  box: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  boxBought: { backgroundColor: colors.purple, borderColor: colors.purple },
  itemName: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  strike: { textDecorationLine: "line-through" },
  done: { alignItems: "center", paddingVertical: 24 },
  quickAdd: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
