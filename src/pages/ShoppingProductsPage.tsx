import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ShoppingProduct } from "../../shared/models";
import { AppCard } from "../components/ui/AppCard";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { shoppingProductService } from "../services/shoppingProductService";

function relativeDate(value: string): string {
  const days = Math.floor((Date.now() - Date.parse(value)) / 86_400_000);
  if (days < 1) return "dzisiaj";
  if (days === 1) return "wczoraj";
  if (days < 7) return days + " dni temu";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
export function ShoppingProductsPage() {
  const [products, setProducts] = useState<ShoppingProduct[]>([]),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState<"frequency" | "recent">("frequency");
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [pendingDelete, setPendingDelete] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    const timer = window.setTimeout(
      () =>
        void shoppingProductService
          .list(query, sort)
          .then((value) => {
            if (current) {
              setProducts(value);
              setError(null);
            }
          })
          .catch((reason) => {
            if (current)
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Nie udało się pobrać historii.",
              );
          })
          .finally(() => {
            if (current) setLoading(false);
          }),
      120,
    );
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query, sort]);
  const remove = async (product: ShoppingProduct) => {
    if (pendingDelete !== product.id) {
      setPendingDelete(product.id);
      return;
    }
    try {
      await shoppingProductService.remove(product.id);
      setProducts((current) =>
        current.filter((item) => item.id !== product.id),
      );
      setPendingDelete(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się usunąć produktu.",
      );
    }
  };
  return (
    <div className="content-stack content-stack--shopping">
      <PageHeader
        eyebrow="Zakupy"
        title="Historia produktów"
        description="Produkty, których Wariatkowo nauczyło się z list zakupów."
        actions={
          <Link className="secondary-button" to="/zakupy">
            Wróć do zakupów
          </Link>
        }
      />
      <AppCard>
        <div className="product-history__tools">
          <label className="field">
            <span className="field__label">Szukaj</span>
            <input
              className="field__input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Mleko…"
              value={query}
            />
          </label>
          <label className="field">
            <span className="field__label">Sortowanie</span>
            <select
              className="field__input"
              onChange={(event) =>
                setSort(event.target.value as "frequency" | "recent")
              }
              value={sort}
            >
              <option value="frequency">Najczęściej dodawane</option>
              <option value="recent">Ostatnio używane</option>
            </select>
          </label>
        </div>
      </AppCard>
      {error ? (
        <ErrorState
          description={error}
          title="Historia chwilowo się schowała."
        />
      ) : null}
      {loading ? <LoadingState label="Szukamy produktów…" /> : null}
      {!loading && !products.length ? (
        <AppCard>
          <EmptyState
            title="Brak produktów"
            description="Historia pojawi się po dodaniu pierwszego produktu."
          />
        </AppCard>
      ) : null}
      {products.length ? (
        <AppCard>
          <ul className="product-history">
            {products.map((product) => (
              <li key={product.id}>
                <div>
                  <strong>{product.name}</strong>
                  <span>
                    Dodawane: {product.timesAdded}{" "}
                    {product.timesAdded === 1 ? "raz" : "razy"} · ostatnio{" "}
                    {relativeDate(product.lastAddedAt)}
                  </span>
                  {product.defaultCategory ? (
                    <small>{product.defaultCategory}</small>
                  ) : null}
                </div>
                <div>
                  {pendingDelete === product.id ? (
                    <button
                      className="ghost-button"
                      onClick={() => setPendingDelete(null)}
                      type="button"
                    >
                      Anuluj
                    </button>
                  ) : null}
                  <button
                    className="ghost-button ghost-button--danger"
                    onClick={() => void remove(product)}
                    type="button"
                  >
                    {pendingDelete === product.id
                      ? "Usuń teraz"
                      : "Usuń z podpowiedzi"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </AppCard>
      ) : null}
    </div>
  );
}
