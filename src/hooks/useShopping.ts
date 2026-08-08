import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreateShoppingItemInput,
  ShoppingItem,
  UpdateShoppingItemInput,
} from "../../shared/models";
import { shoppingService } from "../services/shoppingService";

export type ShoppingLoadState = "idle" | "loading" | "ready" | "error";

function sortShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((first, second) => {
    if (first.checked !== second.checked) {
      return Number(first.checked) - Number(second.checked);
    }

    if (first.sortOrder !== second.sortOrder) {
      return first.sortOrder - second.sortOrder;
    }

    return Date.parse(first.createdAt) - Date.parse(second.createdAt);
  });
}

export function useShopping() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loadState, setLoadState] = useState<ShoppingLoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setError(null);

    try {
      const data = await shoppingService.getAll();
      setItems(sortShoppingItems(data));
      setLoadState("ready");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać zakupów.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  const createItem = useCallback(async (input: CreateShoppingItemInput) => {
    const created = await shoppingService.create(input);
    setItems((current) => sortShoppingItems([created, ...current]));
    return created;
  }, []);

  const updateItem = useCallback(
    async (id: string, input: UpdateShoppingItemInput) => {
      let previous: ShoppingItem[] = [];
      setItems((current) => {
        previous = current;
        return current.map((item) =>
          item.id === id ? { ...item, ...input } : item,
        );
      });

      try {
        const updated = await shoppingService.update(id, input);
        setItems((current) =>
          sortShoppingItems(
            current.map((item) => (item.id === id ? updated : item)),
          ),
        );
        return updated;
      } catch (updateError) {
        setItems(previous);
        throw updateError;
      }
    },
    [],
  );

  const removeItem = useCallback(async (id: string) => {
    let previous: ShoppingItem[] = [];
    setItems((current) => {
      previous = current;
      return current.filter((item) => item.id !== id);
    });

    try {
      await shoppingService.remove(id);
    } catch (removeError) {
      setItems(previous);
      throw removeError;
    }
  }, []);

  const clearCompleted = useCallback(async () => {
    let previous: ShoppingItem[] = [];
    setItems((current) => {
      previous = current;
      return current.filter((item) => !item.checked);
    });

    try {
      await shoppingService.clearCompleted();
    } catch (clearError) {
      setItems(previous);
      throw clearError;
    }
  }, []);

  return useMemo(
    () => ({
      items,
      loadState,
      error,
      refresh: load,
      createItem,
      updateItem,
      removeItem,
      clearCompleted,
    }),
    [
      clearCompleted,
      createItem,
      error,
      load,
      loadState,
      removeItem,
      items,
      updateItem,
    ],
  );
}
