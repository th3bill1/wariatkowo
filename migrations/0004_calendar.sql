PRAGMA foreign_keys = ON;

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('event','appointment','guest','trip','birthday','anniversary','delivery','bill','other')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  all_day INTEGER NOT NULL DEFAULT 1 CHECK (all_day IN (0,1)),
  created_by_member_id TEXT NOT NULL REFERENCES household_members(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_calendar_events_range ON calendar_events (start_date, end_date);
CREATE INDEX idx_calendar_events_creator ON calendar_events (created_by_member_id, start_date);
