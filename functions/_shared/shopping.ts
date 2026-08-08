import type { ShoppingItem } from "../../shared/models";

export type ShoppingRow = {
  id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  is_checked: number;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function toShoppingItem(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    checked: row.is_checked === 1,
    checkedAt: row.checked_at,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
