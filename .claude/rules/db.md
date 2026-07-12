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
- **User identity has no FK.** `ownerId`/`userId` columns (`apiTokens`,
  `workspaces`) are bare `text` — identities live in Keycloak, not this
  database. Every workspace belongs to exactly one user via
  `workspaces.ownerId`, enforced by app-level queries only.
- **Migrations**: always generate, never hand-edit.
  ```bash
  cd packages/db
  npx drizzle-kit generate   # writes to drizzle-pg/
  ```
  Never hand-edit a generated migration file in `drizzle-pg/` or its
  `meta/` snapshots — change the schema and regenerate instead.
