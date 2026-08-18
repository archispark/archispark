-- Removes the "ArchiMate Notation" system pack: its icons are now
-- compiled TSX components in @workspace/image-library
-- (packages/image-library/src/archimate-icons/), consumed directly by the
-- ReactFlow canvas — see apps/server/scripts/generate-archimate-icon-pack.ts.
-- archispark_image also switches from an "img-<uuid>" reference to a plain
-- pack-item slug, globally (every remaining pack: aws/azure/gcp/custom).

-- 1. Rewrite existing archispark_image values ahead of dropping the
--    archimate pack below: anything referencing an item in a pack that
--    survives (aws/azure/gcp/custom) switches to that item's slug; anything
--    else (referenced the archimate pack, or an already-dangling uuid) is
--    cleared to "" (same as the property being unset).
UPDATE "element_properties" AS ep
SET "value" = ipi."slug"
FROM "image_pack_items" AS ipi
JOIN "image_packs" AS ip ON ip."id" = ipi."pack_id"
WHERE ep."property_def_uuid" = 'archispark-image'
  AND ep."value" LIKE 'img-%'
  AND ipi."uuid" = substring(ep."value" from 5)
  AND ip."slug" != 'archimate';
--> statement-breakpoint
UPDATE "relationship_properties" AS rp
SET "value" = ipi."slug"
FROM "image_pack_items" AS ipi
JOIN "image_packs" AS ip ON ip."id" = ipi."pack_id"
WHERE rp."property_def_uuid" = 'archispark-image'
  AND rp."value" LIKE 'img-%'
  AND ipi."uuid" = substring(rp."value" from 5)
  AND ip."slug" != 'archimate';
--> statement-breakpoint
UPDATE "element_properties"
SET "value" = ''
WHERE "property_def_uuid" = 'archispark-image'
  AND "value" LIKE 'img-%'
  AND NOT EXISTS (
    SELECT 1 FROM "image_pack_items" AS ipi
    JOIN "image_packs" AS ip ON ip."id" = ipi."pack_id"
    WHERE ipi."uuid" = substring("element_properties"."value" from 5)
      AND ip."slug" != 'archimate'
  );
--> statement-breakpoint
UPDATE "relationship_properties"
SET "value" = ''
WHERE "property_def_uuid" = 'archispark-image'
  AND "value" LIKE 'img-%'
  AND NOT EXISTS (
    SELECT 1 FROM "image_pack_items" AS ipi
    JOIN "image_packs" AS ip ON ip."id" = ipi."pack_id"
    WHERE ipi."uuid" = substring("relationship_properties"."value" from 5)
      AND ip."slug" != 'archimate'
  );
--> statement-breakpoint

-- 2. Drop the archimate system pack — cascades to its image_pack_items rows.
DELETE FROM "image_packs" WHERE "slug" = 'archimate' AND "organization_id" IS NULL;
--> statement-breakpoint

-- 3. Denormalize organization_id onto image_pack_items (copied once from
--    the parent pack, immutable afterwards — an item never moves pack) so
--    the partial unique indexes below don't need a cross-table predicate.
ALTER TABLE "image_pack_items" ADD COLUMN "organization_id" integer REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
UPDATE "image_pack_items" AS ipi
SET "organization_id" = ip."organization_id"
FROM "image_packs" AS ip
WHERE ipi."pack_id" = ip."id";
--> statement-breakpoint

-- 4. Disambiguate the 3 slug collisions between system vendor packs that
--    survive the archimate pack's removal (aws vs azure vs gcp) — the pack
--    whose own slug sorts first alphabetically keeps the short slug.
UPDATE "image_pack_items" SET "slug" = 'azure-resource-explorer' WHERE "uuid" = '19215be9-21b9-40f9-bcfe-5885e92cd3e1';
--> statement-breakpoint
UPDATE "image_pack_items" SET "slug" = 'azure-savings-plans' WHERE "uuid" = '06c2ebc5-be66-47c5-b512-2c73cb710689';
--> statement-breakpoint
UPDATE "image_pack_items" SET "slug" = 'gcp-marketplace' WHERE "uuid" = 'b08d4ac3-7abc-4266-b2f3-50cfc9267aca';
--> statement-breakpoint

-- 5. Enforce a resolvable, deterministic slug -> item lookup: unique
--    globally among system-pack items, unique per organization among a
--    given organization's own pack items.
CREATE UNIQUE INDEX "image_pack_items_system_slug_uniq" ON "image_pack_items" ("slug") WHERE "organization_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "image_pack_items_org_slug_uniq" ON "image_pack_items" ("organization_id", "slug") WHERE "organization_id" IS NOT NULL;
