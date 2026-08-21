import { Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type {
  CreateShoppingItemInput,
  ShoppingItem,
  ShoppingProduct,
} from "../../../shared/models";
import {
  normalizeProductName,
  SHOPPING_CATEGORIES,
} from "../../../shared/shopping";
import { useAuth } from "./AuthProvider";
import { SelectField } from "./formControls";
import { colors } from "./theme";
import { Button, Field, s } from "./ui";

export function ShoppingQuickAdd({
  items,
  compact = false,
  placeholder = "Co kupujemy?",
  onAdd,
}: {
  items: ShoppingItem[];
  compact?: boolean;
  placeholder?: string;
  onAdd(input: CreateShoppingItemInput): Promise<unknown>;
}) {
  const { api } = useAuth();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("");
  const [suggestions, setSuggestions] = useState<ShoppingProduct[]>([]);
  const [duplicate, setDuplicate] = useState<CreateShoppingItemInput | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const normalized = normalizeProductName(name);
  const activeNames = useMemo(
    () =>
      new Set(
        items
          .filter((item) => !item.checked)
          .map((item) => normalizeProductName(item.name)),
      ),
    [items],
  );

  useEffect(() => {
    if (!normalized) {
      setSuggestions([]);
      return;
    }
    let current = true;
    const timer = setTimeout(
      () =>
        void api.shopping
          .suggestions(name, false, 6)
          .then((products) => current && setSuggestions(products))
          .catch(() => current && setSuggestions([])),
      160,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [api, name, normalized]);

  const add = async (input: CreateShoppingItemInput, force = false) => {
    setError(null);
    if (activeNames.has(normalizeProductName(input.name)) && !force) {
      setDuplicate(input);
      return;
    }
    setSaving(true);
    try {
      await onAdd({ ...input, allowDuplicate: force });
      setName("");
      setQuantity("");
      setCategory("");
      setSuggestions([]);
      setDuplicate(null);
    } catch (reason) {
      const apiReason = reason as Error & { code?: string };
      if (apiReason.code === "DUPLICATE") setDuplicate(input);
      else setError(apiReason.message || "Nie udało się dodać produktu.");
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exact = suggestions.find(
      (item) => item.normalizedName === normalizeProductName(trimmed),
    );
    void add({
      name: trimmed,
      quantity: quantity.trim() || null,
      category: category || exact?.defaultCategory || null,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.quickRow}>
        <View style={s.grow}>
          <Field
            label={compact ? "Dodaj produkt" : "Nazwa"}
            maxLength={180}
            onChangeText={(value) => {
              setName(value);
              setDuplicate(null);
            }}
            onSubmitEditing={submit}
            placeholder={placeholder}
            value={name}
          />
          {suggestions.length ? (
            <View accessibilityRole="list" style={styles.suggestions}>
              {suggestions.map((product) => (
                <Pressable
                  accessibilityRole="button"
                  key={product.id}
                  onPress={() => {
                    if (compact) {
                      void add({
                        name: product.name,
                        category: product.defaultCategory,
                        quantity: null,
                      });
                    } else {
                      setName(product.name);
                      setCategory(product.defaultCategory ?? "");
                      setSuggestions([]);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.suggestion,
                    pressed && s.pressed,
                  ]}
                >
                  <Text style={s.label}>{product.name}</Text>
                  {product.defaultCategory ? (
                    <Text style={s.meta}>{product.defaultCategory}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <Button
          compact
          disabled={saving || !name.trim()}
          Icon={Plus}
          onPress={submit}
          title={saving ? "…" : "Dodaj"}
        />
      </View>
      {!compact && name.trim() ? (
        <View style={styles.details}>
          <Field
            label="Ilość (opcjonalnie)"
            maxLength={60}
            onChangeText={setQuantity}
            placeholder="np. 2 opak."
            value={quantity}
          />
          <SelectField
            label="Kategoria (opcjonalnie)"
            onChange={setCategory}
            options={[
              { value: "", label: "Bez kategorii" },
              ...SHOPPING_CATEGORIES.map((value) => ({ value, label: value })),
            ]}
            value={category}
          />
        </View>
      ) : null}
      {duplicate ? (
        <View style={styles.duplicate}>
          <Text style={s.body}>{duplicate.name} już tu jest 👀</Text>
          <Button
            compact
            onPress={() => void add(duplicate, true)}
            title="Dodaj mimo to"
            variant="ghost"
          />
        </View>
      ) : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 11 },
  quickRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  suggestions: {
    marginTop: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  suggestion: {
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  details: { gap: 11 },
  duplicate: {
    backgroundColor: colors.peachSoft,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
});
