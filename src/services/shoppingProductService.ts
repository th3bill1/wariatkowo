import type { ShoppingProduct } from "../../shared/models";
import { requestJson, requestVoid } from "./http";

const ENDPOINT = "/api/shopping/products";
export const shoppingProductService = {
  list(query = "", sort: "frequency" | "recent" = "frequency") {
    return requestJson<ShoppingProduct[]>(
      ENDPOINT + "?q=" + encodeURIComponent(query) + "&sort=" + sort,
    );
  },
  suggestions(query = "", excludeActive = false, limit = 8) {
    return requestJson<ShoppingProduct[]>(
      ENDPOINT +
        "/suggestions?q=" +
        encodeURIComponent(query) +
        "&excludeActive=" +
        excludeActive +
        "&limit=" +
        limit,
    );
  },
  remove(id: string) {
    return requestVoid(ENDPOINT + "/" + id, { method: "DELETE" });
  },
};
