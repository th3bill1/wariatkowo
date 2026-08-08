import type {
  CreateShoppingItemInput,
  ShoppingItem,
  UpdateShoppingItemInput,
} from "../../shared/models";
import { requestJson, requestVoid } from "./http";

const SHOPPING_ENDPOINT = "/api/shopping";

export const shoppingService = {
  getAll(): Promise<ShoppingItem[]> {
    return requestJson<ShoppingItem[]>(SHOPPING_ENDPOINT);
  },

  create(input: CreateShoppingItemInput): Promise<ShoppingItem> {
    return requestJson<ShoppingItem>(SHOPPING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: UpdateShoppingItemInput): Promise<ShoppingItem> {
    return requestJson<ShoppingItem>(`${SHOPPING_ENDPOINT}/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
  },

  remove(id: string): Promise<void> {
    return requestVoid(`${SHOPPING_ENDPOINT}/${id}`, {
      method: "DELETE",
    });
  },

  clearCompleted(): Promise<void> {
    return requestVoid(`${SHOPPING_ENDPOINT}/completed`, {
      method: "DELETE",
    });
  },
};
