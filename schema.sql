-- Kaizen Management System — D1 database schema
-- Apply once with:
--   wrangler d1 execute <YOUR_DATABASE_NAME> --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS kaizens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  before_text TEXT,
  problem TEXT,
  actionTaken TEXT,
  after_text TEXT,
  benefits TEXT,
  workArea TEXT,       -- JSON array, e.g. ["3. Process Improvement"]
  tqmArea TEXT,        -- JSON array, e.g. ["2. Learning (L)"]
  name TEXT,
  department TEXT,
  month TEXT,
  depot TEXT,
  createdDate TEXT,
  modifiedDate TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT            -- JSON blob of the whole settings object
);
