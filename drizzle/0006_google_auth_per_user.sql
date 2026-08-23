PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO users (id, email, display_name, created_at, updated_at)
VALUES (
  'legacy:koreybadenis@gmail.com',
  'koreybadenis@gmail.com',
  'Legacy owner',
  datetime('now'),
  datetime('now')
);

ALTER TABLE phrases ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS phrase_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id TEXT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pick',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, phrase_id)
);

INSERT OR IGNORE INTO phrase_progress (user_id, phrase_id, status, created_at, updated_at)
SELECT 'legacy:koreybadenis@gmail.com', id, status, created_at, updated_at
FROM phrases;

UPDATE phrases
SET owner_id = 'legacy:koreybadenis@gmail.com'
WHERE source_type = 'custom' AND owner_id IS NULL;

CREATE TABLE phrase_examples_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phrase_id TEXT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  query TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

INSERT INTO phrase_examples_new
  (id, user_id, phrase_id, provider, external_id, query, caption, accent, metadata, created_at)
SELECT
  id,
  'legacy:koreybadenis@gmail.com',
  phrase_id,
  provider,
  external_id,
  query,
  caption,
  accent,
  metadata,
  created_at
FROM phrase_examples;

DROP TABLE phrase_examples;
ALTER TABLE phrase_examples_new RENAME TO phrase_examples;

CREATE UNIQUE INDEX idx_phrase_examples_phrase_provider_external
ON phrase_examples (user_id, phrase_id, provider, external_id);

CREATE TABLE integration_secrets_new (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO integration_secrets_new
  (id, user_id, provider, ciphertext, iv, encryption_version, created_at, updated_at)
SELECT
  'legacy-secret-' || provider,
  'legacy:koreybadenis@gmail.com',
  provider,
  ciphertext,
  iv,
  1,
  created_at,
  updated_at
FROM integration_secrets;

DROP TABLE integration_secrets;
ALTER TABLE integration_secrets_new RENAME TO integration_secrets;

CREATE UNIQUE INDEX idx_integration_secrets_user_provider
ON integration_secrets (user_id, provider);

PRAGMA foreign_keys=ON;
