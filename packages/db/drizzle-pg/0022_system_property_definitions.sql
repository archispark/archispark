ALTER TABLE "property_definitions"
  ADD COLUMN "is_system" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
INSERT INTO "property_definitions" ("workspace_id", "uuid", "name", "type", "is_system")
SELECT "id", 'archispark-image', 'archispark_image', 'string', true
FROM "workspaces"
ON CONFLICT ("workspace_id", "uuid") DO NOTHING;
