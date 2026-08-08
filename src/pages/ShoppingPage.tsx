import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppCard } from "../components/ui/AppCard";
import { CommonProducts } from "../components/shopping/CommonProducts";
import { ProductQuickAdd } from "../components/shopping/ProductQuickAdd";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionHeader } from "../components/ui/SectionHeader";
import { LOADING_COPY } from "../content/loading";
import { SHOPPING_CATEGORIES } from "../content/shoppingCategories";
import { SHOPPING_COPY } from "../content/shopping";
import { useShopping } from "../hooks/useShopping";
import type { ShoppingItem } from "../../shared/models";

type ShoppingFormState = {
  name: string;
  quantity: string;
  category: string;
};

const EMPTY_FORM: ShoppingFormState = {
  name: "",
  quantity: "",
  category: "",
};

function ShoppingComposer({
  initialValue,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  initialValue?: ShoppingFormState;
  onCancel?: () => void;
  onSubmit: (value: ShoppingFormState) => Promise<void>;
  submitLabel: string;
}) {
  const [form, setForm] = useState<ShoppingFormState>(
    initialValue ?? EMPTY_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  return (
    <form
      className="shopping-form"
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
          await onSubmit(form);
          setForm(initialValue ?? EMPTY_FORM);
        } catch (saveError) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "Nie udało się zapisać pozycji.",
          );
        } finally {
          setIsSaving(false);
        }
      }}
    >
      <label className="field field--inline">
        <span className="field__label">{SHOPPING_COPY.nameLabel}</span>
        <input
          className="field__input"
          maxLength={180}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
          placeholder={SHOPPING_COPY.quickAddPlaceholder}
          required
          value={form.name}
        />
      </label>

      <label className="field field--inline">
        <span className="field__label">{SHOPPING_COPY.quantityLabel}</span>
        <input
          className="field__input"
          maxLength={60}
          onChange={(event) =>
            setForm((current) => ({ ...current, quantity: event.target.value }))
          }
          placeholder="2 opak."
          value={form.quantity}
        />
      </label>

      <label className="field field--inline">
        <span className="field__label">{SHOPPING_COPY.categoryLabel}</span>
        <select
          className="field__input"
          onChange={(event) =>
            setForm((current) => ({ ...current, category: event.target.value }))
          }
          value={form.category}
        >
          <option value="">Wybierz kategorię</option>
          {SHOPPING_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p className="form-message form-message--error">{error}</p>
      ) : null}

      <div className="shopping-form__actions">
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? "Zapisywanie..." : submitLabel}
        </button>
        {onCancel ? (
          <button
            className="secondary-button"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            {SHOPPING_COPY.cancelButton}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ShoppingRow({
  item,
  onToggle,
  onEdit,
  onDelete,
  onSaveEdit,
  onCancelEdit,
  onCancelDelete,
  deletePending,
  editing,
}: {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => Promise<void>;
  onEdit: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  onSaveEdit: (item: ShoppingItem, value: ShoppingFormState) => Promise<void>;
  onCancelEdit: () => void;
  onCancelDelete: () => void;
  deletePending: boolean;
  editing: boolean;
}) {
  const initialForm = {
    name: item.name,
    quantity: item.quantity ?? "",
    category: item.category ?? "",
  };

  return (
    <li
      className={[
        "shopping-row",
        item.checked ? "shopping-row--checked" : "",
      ].join(" ")}
    >
      <div className="shopping-row__main">
        <button
          aria-label={
            item.checked ? "Oznacz jako do kupienia" : "Oznacz jako kupione"
          }
          className="shopping-row__check"
          onClick={() => void onToggle(item)}
          type="button"
        >
          <span className="shopping-row__checkmark" aria-hidden="true">
            {item.checked ? "✓" : "□"}
          </span>
        </button>

        <div className="shopping-row__copy">
          <div className="shopping-row__title-line">
            <p className="shopping-row__title">{item.name}</p>
            {item.quantity ? (
              <span className="shopping-row__badge">{item.quantity}</span>
            ) : null}
          </div>
          {item.category ? (
            <p className="shopping-row__meta">{item.category}</p>
          ) : null}
        </div>
      </div>

      <div className="shopping-row__actions">
        <button
          className="ghost-button"
          onClick={() => onEdit(item)}
          type="button"
        >
          {SHOPPING_COPY.editButton}
        </button>
        {deletePending ? (
          <>
            <button
              className="ghost-button"
              onClick={onCancelDelete}
              type="button"
            >
              {SHOPPING_COPY.cancelButton}
            </button>
            <button
              className="ghost-button ghost-button--danger"
              onClick={() => onDelete(item)}
              type="button"
            >
              Usuń teraz
            </button>
          </>
        ) : (
          <button
            className="ghost-button ghost-button--danger"
            onClick={() => onDelete(item)}
            type="button"
          >
            {SHOPPING_COPY.deleteButton}
          </button>
        )}
      </div>

      {editing ? (
        <div className="shopping-row__editor">
          <ShoppingComposer
            initialValue={initialForm}
            onCancel={onCancelEdit}
            onSubmit={(value) => onSaveEdit(item, value)}
            submitLabel={SHOPPING_COPY.saveButton}
          />
        </div>
      ) : null}
    </li>
  );
}

export function ShoppingPage() {
  const {
    items,
    loadState,
    error,
    refresh,
    createItem,
    updateItem,
    removeItem,
    clearCompleted,
  } = useShopping();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const todoItems = useMemo(
    () => items.filter((item) => !item.checked),
    [items],
  );
  const boughtItems = useMemo(
    () => items.filter((item) => item.checked),
    [items],
  );

  const handleEdit = (item: ShoppingItem) => {
    setEditingItemId(item.id);
    setPendingDeleteId(null);
  };

  const handleDelete = async (item: ShoppingItem) => {
    setActionError(null);

    if (pendingDeleteId !== item.id) {
      setPendingDeleteId(item.id);
      return;
    }

    try {
      await removeItem(item.id);
      setPendingDeleteId(null);
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Nie udało się usunąć pozycji.",
      );
      setPendingDeleteId(null);
    }
  };

  const handleSaveEdit = async (
    item: ShoppingItem,
    value: ShoppingFormState,
  ) => {
    setActionError(null);

    try {
      await updateItem(item.id, {
        name: value.name,
        quantity: value.quantity.trim() ? value.quantity : null,
        category: value.category.trim() ? value.category : null,
      });
      setEditingItemId(null);
    } catch (saveError) {
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : "Nie udało się zapisać pozycji.",
      );
      throw saveError;
    }
  };

  const handleToggle = async (item: ShoppingItem) => {
    setActionError(null);

    try {
      await updateItem(item.id, { checked: !item.checked });
    } catch (toggleError) {
      setActionError(
        toggleError instanceof Error
          ? toggleError.message
          : "Nie udało się zmienić stanu pozycji.",
      );
    }
  };

  return (
    <div className="content-stack content-stack--shopping">
      <PageHeader
        eyebrow="Lista pod ręką"
        title={SHOPPING_COPY.heading}
        description="Może o niczym nie zapomnimy"
        actions={
          <div className="page-header__action-group">
            <Link className="primary-button" to="/zakupy/sklep">
              Tryb sklepowy
            </Link>
            <Link className="secondary-button" to="/zakupy/produkty">
              Historia produktów
            </Link>
          </div>
        }
      />

      <AppCard>
        <SectionHeader
          title="Szybkie dodanie"
          description="Wpisz nazwę lub wybierz podpowiedź."
        />
        <ProductQuickAdd items={items} onAdd={createItem} />
        <CommonProducts
          refreshKey={items
            .map((item) => `${item.id}:${item.checked}`)
            .join("|")}
          onAdd={createItem}
        />
      </AppCard>

      {actionError ? (
        <ErrorState
          description={actionError}
          title="Nie udało się wykonać zmiany."
        />
      ) : null}

      {loadState === "loading" ? (
        <LoadingState label={LOADING_COPY.shopping} />
      ) : null}
      {loadState === "error" ? (
        <ErrorState
          description={error ?? "Nie udało się pobrać zakupów."}
          onRetry={refresh}
          title="Nie udało się pobrać zakupów."
        />
      ) : null}

      {loadState === "ready" && items.length === 0 ? (
        <AppCard>
          <EmptyState
            description={SHOPPING_COPY.emptyDescription}
            title={SHOPPING_COPY.emptyTitle}
          />
        </AppCard>
      ) : null}

      {loadState === "ready" && items.length > 0 ? (
        <div className="shopping-layout">
          <AppCard>
            <SectionHeader
              title={SHOPPING_COPY.todoSection}
              description={`${todoItems.length} pozycji`}
            />
            <ul className="shopping-list">
              {todoItems.map((item) => (
                <ShoppingRow
                  editing={editingItemId === item.id}
                  deletePending={pendingDeleteId === item.id}
                  key={item.id}
                  onCancelEdit={() => setEditingItemId(null)}
                  onCancelDelete={() => setPendingDeleteId(null)}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onSaveEdit={handleSaveEdit}
                  onToggle={handleToggle}
                  item={item}
                />
              ))}
            </ul>
          </AppCard>

          {boughtItems.length > 0 ? (
            <AppCard>
              <SectionHeader
                title={SHOPPING_COPY.boughtSection}
                description={`${boughtItems.length} kupionych pozycji`}
                actions={
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setActionError(null);
                      void clearCompleted().catch((clearError) => {
                        setActionError(
                          clearError instanceof Error
                            ? clearError.message
                            : "Nie udało się usunąć kupionych pozycji.",
                        );
                      });
                    }}
                    type="button"
                  >
                    {SHOPPING_COPY.clearCompleted}
                  </button>
                }
              />
              <ul className="shopping-list shopping-list--quiet">
                {boughtItems.map((item) => (
                  <ShoppingRow
                    editing={editingItemId === item.id}
                    deletePending={pendingDeleteId === item.id}
                    key={item.id}
                    onCancelEdit={() => setEditingItemId(null)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onSaveEdit={handleSaveEdit}
                    onToggle={handleToggle}
                    item={item}
                  />
                ))}
              </ul>
            </AppCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
