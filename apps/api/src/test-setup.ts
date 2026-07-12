import { runMigrations } from "@workspace/db";

// Tests run against PGlite (in-memory Postgres). Apply the drizzle-pg migrations
// once before the suite so every tenant table (workspaces, elements,
// relationships, views, ...) exists. runMigrations() is idempotent.
await runMigrations();
