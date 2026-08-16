import type { ShoppingProduct } from "../../shared/models";

export type ShoppingProductRow = {
  id: string;
  name: string;
  normalized_name: string;
  default_category: string | null;
  times_added: number;
  last_added_at: string;
  created_at: string;
};

export function toShoppingProduct(row: ShoppingProductRow): ShoppingProduct {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    defaultCategory: row.default_category,
    timesAdded: row.times_added,
    lastAddedAt: row.last_added_at,
    createdAt: row.created_at,
  };
}

export const SHOPPING_PRODUCT_COLUMNS =
  "id,name,normalized_name,default_category,times_added,last_added_at,created_at";
