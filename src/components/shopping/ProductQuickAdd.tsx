import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  CreateShoppingItemInput,
  ShoppingItem,
  ShoppingProduct,
} from "../../../shared/models";
import { normalizeProductName } from "../../../shared/shopping";
import { SHOPPING_CATEGORIES } from "../../content/shoppingCategories";
import { shoppingProductService } from "../../services/shoppingProductService";

export function ProductQuickAdd({
  items,
  onAdd,
  compact = false,
  placeholder = "Co kupujemy?",
}: {
  items: ShoppingItem[];
  onAdd: (input: CreateShoppingItemInput) => Promise<unknown>;
  compact?: boolean;
  placeholder?: string;
}) {
  const [name, setName] = useState(""),
    [quantity, setQuantity] = useState(""),
    [category, setCategory] = useState(""),
    [suggestions, setSuggestions] = useState<ShoppingProduct[]>([]);
  const [error, setError] = useState<string | null>(null),
    [duplicate, setDuplicate] = useState<CreateShoppingItemInput | null>(null),
    [saving, setSaving] = useState(false);
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
    const timer = window.setTimeout(
      () =>
        void shoppingProductService
          .suggestions(name, false, 6)
          .then((value) => {
            if (current) setSuggestions(value);
          })
          .catch(() => {
            if (current) setSuggestions([]);
          }),
      140,
    );
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [name, normalized]);
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
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const exact = suggestions.find(
      (item) => item.normalizedName === normalizeProductName(trimmed),
    );
    void add({
      name: trimmed,
      category: category || exact?.defaultCategory || null,
      quantity: quantity.trim() || null,
    });
  };
  return (
    <div
      className={
        compact
          ? "product-quick-add product-quick-add--compact"
          : "product-quick-add"
      }
    >
      <form className="quick-add" onSubmit={submit}>
        <div className="suggestion-field">
          <input
            aria-autocomplete="list"
            autoComplete="off"
            className="field__input quick-add__input"
            maxLength={180}
            onChange={(event) => {
              setName(event.target.value);
              setDuplicate(null);
            }}
            placeholder={placeholder}
            value={name}
          />
          {suggestions.length ? (
            <ul className="suggestion-list" role="listbox">
              {suggestions.map((product) => (
                <li key={product.id}>
                  <button
                    onClick={() => {
                      if (compact) {
                        void add({
                          name: product.name,
                          category: product.defaultCategory,
                          quantity: null,
                        });
                        return;
                      }
                      setName(product.name);
                      setCategory(product.defaultCategory ?? "");
                      setSuggestions([]);
                      setDuplicate(null);
                    }}
                    type="button"
                  >
                    <span>{product.name}</span>
                    {product.defaultCategory ? (
                      <small>{product.defaultCategory}</small>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          className="primary-button quick-add__button"
          disabled={saving || !name.trim()}
          type="submit"
        >
          {saving ? "Dodaję…" : "Dodaj"}
        </button>
        {!compact && name.trim() ? (
          <div className="quick-add__details">
            <label className="field">
              <span className="field__label">Ilość <small>(opcjonalnie)</small></span>
              <input
                className="field__input"
                maxLength={60}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="np. 2 opak."
                value={quantity}
              />
            </label>
            <label className="field">
              <span className="field__label">Kategoria <small>(opcjonalnie)</small></span>
              <select className="field__input" onChange={(event) => setCategory(event.target.value)} value={category}>
                <option value="">Bez kategorii</option>
                {SHOPPING_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
        ) : null}
      </form>
      {duplicate ? (
        <div className="duplicate-warning" role="alert">
          <span>{duplicate.name} już tu jest 👀</span>
          <button
            className="ghost-button"
            disabled={saving}
            onClick={() => void add(duplicate, true)}
            type="button"
          >
            Dodaj mimo to
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="form-message form-message--error">{error}</p>
      ) : null}
    </div>
  );
}
