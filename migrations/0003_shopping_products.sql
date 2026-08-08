CREATE TABLE shopping_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  default_category TEXT,
  times_added INTEGER NOT NULL DEFAULT 1,
  last_added_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_shopping_products_normalized ON shopping_products (normalized_name);
CREATE INDEX idx_shopping_products_frequency ON shopping_products (times_added DESC);
CREATE INDEX idx_shopping_products_recent ON shopping_products (last_added_at DESC);

ALTER TABLE shopping_items ADD COLUMN normalized_name TEXT;
UPDATE shopping_items SET normalized_name = lower(trim(name)) WHERE normalized_name IS NULL;
CREATE INDEX idx_shopping_items_active_normalized
  ON shopping_items (normalized_name, is_checked);
