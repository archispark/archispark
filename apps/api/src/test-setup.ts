import { sqlite } from "@workspace/db";

if (!sqlite) throw new Error("test-setup requires SQLite driver");

// Create Better Auth tables + seed users for test environment (in-memory DB)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    username TEXT NOT NULL,
    display_username TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    banned INTEGER,
    ban_reason TEXT,
    ban_expires INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS user_username_uniq ON "user"(username);

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS session_token_uniq ON session(token);

  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at INTEGER,
    refresh_token_expires_at INTEGER,
    scope TEXT,
    password TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  );
`);

// Create oauth_providers table for tests (created by migration in production)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS oauth_providers (
    id TEXT PRIMARY KEY NOT NULL,
    provider_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    issuer_url TEXT,
    tenant_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE UNIQUE INDEX IF NOT EXISTS oauth_providers_provider_id_uniq ON oauth_providers (provider_id);
`);
