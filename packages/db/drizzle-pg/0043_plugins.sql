-- Drops the DB-backed image-pack system (image_packs / image_pack_items),
-- replaced by file-backed plugins (plugins/<slug>/, see
-- apps/server/scripts/generate-plugin-registry.ts) tracked only by an
-- enabled flag in the new "plugins" table. System vendor packs (aws/azure/
-- gcp) survive as file-based plugins with the same item slugs, so their
-- archispark_image values keep resolving unchanged.
--
-- BREAKING: organization-scoped custom packs (uploaded via
-- /platform/image-library) have no file-based replacement — any
-- archispark_image value referencing one of their items stops resolving
-- after this migration (falls back to the default ArchiMate type icon; the
-- stored value itself is cleared here rather than left dangling).

-- 1. Clear archispark_image values that resolved through a *custom*
--    (organization-scoped) pack item — no successor exists for these.
UPDATE "element_properties" AS ep
SET "value" = ''
WHERE ep."property_def_uuid" = 'archispark-image'
  AND EXISTS (
    SELECT 1 FROM "image_pack_items" AS ipi
    WHERE ipi."slug" = ep."value" AND ipi."organization_id" IS NOT NULL
  );
--> statement-breakpoint
UPDATE "relationship_properties" AS rp
SET "value" = ''
WHERE rp."property_def_uuid" = 'archispark-image'
  AND EXISTS (
    SELECT 1 FROM "image_pack_items" AS ipi
    WHERE ipi."slug" = rp."value" AND ipi."organization_id" IS NOT NULL
  );
--> statement-breakpoint

-- 2. Drop the old tables.
DROP TABLE "image_pack_items";
--> statement-breakpoint
DROP TABLE "image_packs";
--> statement-breakpoint

-- 3. Create the new plugins table — instance-wide enabled flag per plugin
--    slug, discovered at build time from plugins/<slug>/ (see
--    apps/server/lib/plugins/registry.generated.ts).
CREATE TABLE "plugins" (
  "id" serial PRIMARY KEY,
  "slug" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "created_at" integer NOT NULL DEFAULT extract(epoch from now())::int,
  "updated_at" integer NOT NULL DEFAULT extract(epoch from now())::int
);
--> statement-breakpoint
CREATE UNIQUE INDEX "plugins_slug_uniq" ON "plugins" ("slug");
--> statement-breakpoint

-- 4. Seed the 3 known vendor plugins as enabled — preserves current
--    behavior (aws/azure/gcp were always resolvable) across the cutover.
INSERT INTO "plugins" ("slug", "enabled") VALUES ('aws', true), ('azure', true), ('gcp', true);
