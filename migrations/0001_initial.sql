CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  due_date TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_tasks_completion_due ON tasks (is_completed, due_date);
CREATE INDEX idx_tasks_sort_order ON tasks (sort_order);
CREATE INDEX idx_tasks_created_at ON tasks (created_at);

CREATE TABLE shopping_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity TEXT,
  category TEXT,
  is_checked INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_shopping_items_checked_order ON shopping_items (is_checked, sort_order);
CREATE INDEX idx_shopping_items_category ON shopping_items (category);
CREATE INDEX idx_shopping_items_created_at ON shopping_items (created_at);
