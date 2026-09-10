CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,      -- GitHub user id
  login        TEXT NOT NULL,
  name         TEXT,
  avatar_url   TEXT NOT NULL,
  -- GitHub OAuth token used to list the user's repos and pull requests.
  -- Production would encrypt this column at rest.
  access_token TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bounties (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL,
  repo_url            TEXT,
  repo_full_name      TEXT,                 -- owner/name on GitHub, when picked from the poster's repos
  poster_user_id      TEXT REFERENCES users(id),
  amount_sats         INTEGER NOT NULL CHECK (amount_sats > 0),
  status              TEXT NOT NULL CHECK (status IN ('unfunded','funded','submitted','paid','cancelled','expired')),
  payment_hash        TEXT NOT NULL UNIQUE,
  hold_invoice        TEXT NOT NULL,
  -- MVP only. Revealing the preimage releases the escrow, so production would
  -- keep it in a KMS or HSM rather than next to the bounty row.
  preimage            TEXT NOT NULL,
  poster_secret       TEXT NOT NULL,
  funded_at           TEXT,
  expires_at          TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  payout_payment_hash TEXT
);

CREATE TABLE IF NOT EXISTS submissions (
  id             TEXT PRIMARY KEY,
  bounty_id      TEXT NOT NULL REFERENCES bounties(id),
  worker_name    TEXT NOT NULL,
  worker_user_id TEXT REFERENCES users(id),
  work_url       TEXT NOT NULL,
  pr_number      INTEGER,
  pr_title       TEXT,
  notes          TEXT NOT NULL DEFAULT '',
  payout_invoice TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  decided_at     TEXT,
  decision       TEXT CHECK (decision IN ('approved','rejected')),
  -- Set when the hold invoice settled but paying the worker failed.
  payout_error   TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bounty_id  TEXT NOT NULL REFERENCES bounties(id),
  type       TEXT NOT NULL,
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS submissions_bounty ON submissions(bounty_id);
CREATE INDEX IF NOT EXISTS events_bounty ON events(bounty_id);
