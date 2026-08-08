import { useEffect, useState } from "react";
import type {
  CreateShoppingItemInput,
  ShoppingProduct,
} from "../../../shared/models";
import { shoppingProductService } from "../../services/shoppingProductService";

export function CommonProducts({
  refreshKey,
  onAdd,
}: {
  refreshKey: string;
  onAdd: (input: CreateShoppingItemInput) => Promise<unknown>;
}) {
  const [products, setProducts] = useState<ShoppingProduct[]>([]);
  useEffect(() => {
    let current = true;
    void shoppingProductService
      .suggestions("", true, 8)
      .then((value) => {
        if (current) setProducts(value);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [refreshKey]);
  if (!products.length) return null;
  return (
    <section
      className="common-products"
      aria-labelledby="common-products-title"
    >
      <h3 id="common-products-title">Często kupowane</h3>
      <div>
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() =>
              void onAdd({
                name: product.name,
                category: product.defaultCategory,
                quantity: null,
              })
            }
            type="button"
          >
            + {product.name}
          </button>
        ))}
      </div>
    </section>
  );
}
