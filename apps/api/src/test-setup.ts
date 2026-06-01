import { runMigrations } from "@workspace/db";

// Tests run against PGlite (in-memory Postgres). Apply the drizzle-pg migrations
// once before the suite so every table (model, RBAC, Better Auth, OAuth
// providers) exists. runMigrations() is idempotent — registry's startup also
// calls it, and drizzle tracks applied migrations.
await runMigrations();
