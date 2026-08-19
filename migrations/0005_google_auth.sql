ALTER TABLE household_members ADD COLUMN google_email TEXT;
ALTER TABLE household_members ADD COLUMN google_sub TEXT;

CREATE UNIQUE INDEX idx_household_members_google_email
  ON household_members (google_email COLLATE NOCASE)
  WHERE google_email IS NOT NULL;

CREATE UNIQUE INDEX idx_household_members_google_sub
  ON household_members (google_sub)
  WHERE google_sub IS NOT NULL;
