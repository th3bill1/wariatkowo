PRAGMA foreign_keys = ON;

CREATE TABLE google_calendar_connections (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE REFERENCES household_members(id) ON DELETE CASCADE,
  google_sub TEXT NOT NULL UNIQUE,
  google_email TEXT NOT NULL COLLATE NOCASE,
  encrypted_refresh_token TEXT NOT NULL,
  granted_scopes TEXT NOT NULL,
  calendar_list_sync_token TEXT,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_sync_at TEXT,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected','needs_reconnect','error')),
  last_error TEXT
);

CREATE TABLE google_calendar_oauth_states (
  state_hash TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_google_calendar_oauth_expiry
  ON google_calendar_oauth_states (expires_at);

CREATE TABLE google_calendars (
  calendar_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  description TEXT,
  time_zone TEXT,
  background_color TEXT,
  foreground_color TEXT,
  preferred_connection_id TEXT REFERENCES google_calendar_connections(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE google_calendar_access (
  connection_id TEXT NOT NULL REFERENCES google_calendar_connections(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL REFERENCES google_calendars(calendar_id) ON DELETE CASCADE,
  access_role TEXT NOT NULL CHECK (
    access_role IN ('owner','writer','writerWithoutPrivateAccess','reader','freeBusyReader')
  ),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  selected INTEGER NOT NULL DEFAULT 1 CHECK (selected IN (0,1)),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  summary_override TEXT,
  background_color TEXT,
  foreground_color TEXT,
  event_sync_token TEXT,
  last_sync_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (connection_id, calendar_id)
);
CREATE INDEX idx_google_calendar_access_calendar
  ON google_calendar_access (calendar_id, active, access_role);

CREATE TABLE google_calendar_events (
  id TEXT PRIMARY KEY,
  google_calendar_id TEXT NOT NULL REFERENCES google_calendars(calendar_id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  etag TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  summary TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
  time_zone TEXT,
  organizer_json TEXT,
  attendees_json TEXT,
  html_link TEXT,
  hangout_link TEXT,
  event_type TEXT,
  visibility TEXT,
  recurrence_json TEXT,
  recurring_event_id TEXT,
  original_start_time TEXT,
  extended_properties_json TEXT,
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0,1)),
  wariatkowo_type TEXT NOT NULL DEFAULT 'event' CHECK (
    wariatkowo_type IN ('event','appointment','guest','trip','birthday','anniversary','delivery','bill','other')
  ),
  google_updated_at TEXT,
  last_synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (google_calendar_id, google_event_id)
);
CREATE INDEX idx_google_calendar_events_range
  ON google_calendar_events (start_date, end_date);
CREATE INDEX idx_google_calendar_events_calendar
  ON google_calendar_events (google_calendar_id, start_date);
