import { Check, ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { groupByShoppingCategory } from "../../shared/shopping";
import { ProductQuickAdd } from "../components/shopping/ProductQuickAdd";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { SHOPPING_CATEGORIES } from "../content/shoppingCategories";
import { useShopping } from "../hooks/useShopping";

export function ShopModePage() {
  const { items, loadState, error, refresh, createItem, updateItem } =
    useShopping();
  const [actionError, setActionError] = useState<string | null>(null);
  const active = items.filter((item) => !item.checked);
  const bought = items.filter((item) => item.checked);

  const groups = useMemo(
    () => groupByShoppingCategory(active, SHOPPING_CATEGORIES),
    [active],
  );

  const toggle = async (item: (typeof items)[number]) => {
    setActionError(null);
    try {
      await updateItem(item.id, { checked: !item.checked });
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się zmienić produktu.",
      );
    }
  };

  return (
    <main className="shop-mode">
      <header className="shop-mode__header">
        <Link aria-label="Wróć do zwykłej listy" to="/zakupy">
          <ChevronLeft /> Zakupy
        </Link>
        <strong>{active.length} zostało</strong>
      </header>
      {loadState === "loading" ? (
        <LoadingState label="Pakujemy listę…" />
      ) : null}
      {loadState === "error" ? (
        <ErrorState
          description={error ?? "Nie udało się pobrać zakupów."}
          onRetry={refresh}
          title="Lista nie chce się otworzyć."
        />
      ) : null}
      {actionError ? (
        <ErrorState
          description={actionError}
          title="Nie udało się odhaczyć produktu."
        />
      ) : null}
      {loadState === "ready" && !active.length ? (
        <div className="shop-mode__empty">
          <Check aria-hidden="true" />
          <h1>Wszystko kupione</h1>
          <p>Można wracać do Wariatkowa.</p>
        </div>
      ) : null}
      <div className="shop-mode__groups">
        {groups.map(([category, values]) => (
          <section className="shop-group" key={category}>
            <h2>{category}</h2>
            <div>
              {values.map((item) => (
                <button
                  className="shop-item"
                  key={item.id}
                  onClick={() => void toggle(item)}
                  type="button"
                >
                  <span aria-hidden="true" className="shop-item__box" />
                  <span>
                    <strong>{item.name}</strong>
                    {item.quantity ? <small>{item.quantity}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {bought.length ? (
        <details className="shop-bought">
          <summary>
            Kupione <span>{bought.length}</span>
          </summary>
          <div>
            {bought.map((item) => (
              <button
                className="shop-item shop-item--bought"
                key={item.id}
                onClick={() => void toggle(item)}
                type="button"
              >
                <span aria-hidden="true" className="shop-item__box">
                  <Check />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  {item.quantity ? <small>{item.quantity}</small> : null}
                </span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
      <aside className="shop-mode__quick-add">
        <ProductQuickAdd
          compact
          items={items}
          onAdd={createItem}
          placeholder="Dodaj produkt"
        />
      </aside>
    </main>
  );
}
