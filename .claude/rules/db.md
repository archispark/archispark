---
paths:
  - "packages/db/**"
---

# Database conventions (`packages/db`)

- **Timestamps are Unix-epoch integers**, not Postgres `timestamp`:
  `integer("created_at").notNull().default(sql\`extract(epoch from now())::int\`)`.
  Don't reach for `timestamp()` or a `Date` column.
- **No Drizzle `relations()` helpers** are defined in `schema.ts` — all
  joins are done manually with `eq()`/`and()` in `store.ts`/
  `registry.ts`. Don't expect `db.query.workspaces.with(...)` to work.
- **Mixed FK strategy, by design**: hierarchical ownership chains
  (`workspaceId`, `viewId`, `elementId`) use real integer FKs with
  `.references(() => table.id, { onDelete: "cascade" })`. ArchiMate
  cross-references (relationship `sourceUuid`/`targetUuid`, node
  `elementUuid`/`parentNodeUuid`, connection `relationshipUuid`) are
  plain `text` UUID columns with **no** FK constraint — this matches
  the Open Exchange XML `xs:ID` format (`"id-"` prefix); referential
  integrity there is app-enforced, not DB-enforced. Don't "fix" these
  into FKs.
- **User identity has no FK.** `userId` columns (`apiTokens`,
  `organizationMembers`) and `workspaces.createdById` are bare `text` —
  identities live in Keycloak, not this database. Every workspace belongs
  to exactly one **organization** via `workspaces.organizationId`
  (enforced by `apps/api/src/access.ts`, not by app-level query scoping on
  a user id); `createdById` is traceability only, never used for access
  control.
- **Idempotent startup backfill, not a one-shot data migration.** When a
  schema change needs to populate a new NOT-NULL-eventually column across
  existing rows (e.g. `workspaces.organization_id`,
  `packages/db/src/backfill-organizations.ts`), prefer a small function
  that's safe to call on every app startup — guarded entirely by `WHERE
  <col> IS NULL` — over a single migration-time data fix. Called right
  after `runMigrations()` in both `apps/api/src/main.ts` and
  `apps/api/api/index.ts`, and exposed as a standalone
  `pnpm --filter @workspace/db backfill:prod` script
  (`packages/db/scripts/backfill-prod.ts`) for manual runs against a
  target database — see `docs/deployment.md`. This is the expand phase's
  companion: the DDL (migration) adds a nullable column, the backfill
  populates it, and only after verifying zero NULLs in the target
  environment does a later, separate migration add the `NOT NULL`
  constraint (contract phase) — never bundle expand+contract in one
  migration for a column with existing data.
- **Migrations**: always generate, never hand-edit.
  ```bash
  cd packages/db
  npx drizzle-kit generate   # writes to drizzle-pg/
  ```
  Never hand-edit a generated migration file in `drizzle-pg/` or its
  `meta/` snapshots — change the schema and regenerate instead. **Known
  gap**: as of the 0018 migration, `drizzle-pg/meta/` was missing
  snapshots `0003`–`0017` (only `0000`–`0002` were committed), so
  `generate` misdiffed against a years-stale snapshot and had to be
  repaired by hand (a fresh baseline snapshot reconstructed from the
  pre-0018 schema, saved as `0018_snapshot.json`). If `generate` ever
  again proposes renaming/dropping tables that don't match your actual
  change, check `git ls-tree HEAD -- packages/db/drizzle-pg/meta` against
  `_journal.json`'s entry count before trusting the diff.
