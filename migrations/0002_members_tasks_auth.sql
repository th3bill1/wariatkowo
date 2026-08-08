PRAGMA foreign_keys = ON;
CREATE TABLE household_members (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug IN ('misiek', 'miska')),
  pin_hash TEXT, pin_salt TEXT, pin_iterations INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT INTO household_members (id, name, slug, created_at, updated_at) VALUES
 ('member-misiek', 'Misiek', 'misiek', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
 ('member-miska', 'Miśka', 'miska', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
CREATE TABLE sessions (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
 member_id TEXT NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_token_expiry ON sessions (token_hash, expires_at);
CREATE TABLE login_attempts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, member_key TEXT NOT NULL,
 client_hash TEXT NOT NULL, attempted_at TEXT NOT NULL, succeeded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_login_attempts_lookup ON login_attempts (member_key, client_hash, attempted_at);
ALTER TABLE tasks ADD COLUMN assignment TEXT NOT NULL DEFAULT 'anyone' CHECK (assignment IN ('anyone','misiek','miska','both'));
ALTER TABLE tasks ADD COLUMN recurrence_unit TEXT CHECK (recurrence_unit IS NULL OR recurrence_unit IN ('day','week','month'));
ALTER TABLE tasks ADD COLUMN recurrence_interval INTEGER CHECK (recurrence_interval IS NULL OR recurrence_interval BETWEEN 1 AND 365);
ALTER TABLE tasks ADD COLUMN recurrence_series_id TEXT;
ALTER TABLE tasks ADD COLUMN generated_from_task_id TEXT;
CREATE UNIQUE INDEX idx_tasks_generated_from ON tasks (generated_from_task_id) WHERE generated_from_task_id IS NOT NULL;
CREATE INDEX idx_tasks_assignment_completion ON tasks (assignment, is_completed);
CREATE TABLE task_completion_events (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE,
 completed_by_member_id TEXT NOT NULL REFERENCES household_members(id),
 completed_at TEXT NOT NULL,
 assignment_snapshot TEXT NOT NULL CHECK (assignment_snapshot IN ('anyone','misiek','miska','both')),
 title_snapshot TEXT NOT NULL
);
CREATE INDEX idx_task_completion_stats ON task_completion_events (completed_at, assignment_snapshot, completed_by_member_id);
