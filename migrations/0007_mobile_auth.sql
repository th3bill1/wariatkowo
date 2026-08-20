CREATE TABLE mobile_login_codes (
  code_hash TEXT PRIMARY KEY,
  session_token TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_mobile_login_codes_expiry ON mobile_login_codes(expires_at);
