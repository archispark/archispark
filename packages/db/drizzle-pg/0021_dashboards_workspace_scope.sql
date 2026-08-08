-- Dashboards were initially scoped to organizations.  A single organization
-- can contain several workspaces, so retain the existing dashboards for each
-- workspace independently before removing the organization-level scope.
ALTER TABLE "dashboards" ADD COLUMN "workspace_id" integer;
--> statement-breakpoint
UPDATE "dashboards" d
SET "workspace_id" = (
  SELECT w."id"
  FROM "workspaces" w
  WHERE w."organization_id" = d."organization_id"
  ORDER BY w."id"
  LIMIT 1
);
--> statement-breakpoint
-- A dashboard belonging to an organization without any workspace cannot be
-- represented after this migration.  Remove these orphaned heads before the
-- NOT NULL constraint; their revisions are removed by the existing cascade.
DELETE FROM "dashboards"
WHERE "workspace_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "dashboards" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
DROP INDEX "dashboards_org_dashboard_id_uniq";
--> statement-breakpoint
INSERT INTO "dashboards" ("workspace_id", "dashboard_id", "is_provisioned", "latest_revision", "created_by_id", "created_at", "deleted_at")
SELECT w."id", source."dashboard_id", source."is_provisioned", source."latest_revision", source."created_by_id", source."created_at", source."deleted_at"
FROM "dashboards" source
JOIN "workspaces" w ON w."organization_id" = source."organization_id"
WHERE source."workspace_id" = (
  SELECT first_workspace."id"
  FROM "workspaces" first_workspace
  WHERE first_workspace."organization_id" = source."organization_id"
  ORDER BY first_workspace."id"
  LIMIT 1
)
  AND w."id" <> source."workspace_id";
--> statement-breakpoint
INSERT INTO "dashboard_revisions" ("dashboard_id", "revision", "definition", "created_by_id", "created_at")
SELECT copy."id", revision."revision", revision."definition", revision."created_by_id", revision."created_at"
FROM "dashboards" source
JOIN "workspaces" w ON w."organization_id" = source."organization_id"
JOIN "dashboards" copy ON copy."workspace_id" = w."id" AND copy."dashboard_id" = source."dashboard_id"
JOIN "dashboard_revisions" revision ON revision."dashboard_id" = source."id"
WHERE source."workspace_id" = (
  SELECT first_workspace."id"
  FROM "workspaces" first_workspace
  WHERE first_workspace."organization_id" = source."organization_id"
  ORDER BY first_workspace."id"
  LIMIT 1
)
  AND copy."id" <> source."id";
--> statement-breakpoint
ALTER TABLE "dashboards" DROP CONSTRAINT "dashboards_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "dashboards" DROP COLUMN "organization_id";
--> statement-breakpoint
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "dashboards_workspace_dashboard_id_uniq" ON "dashboards" USING btree ("workspace_id", "dashboard_id");
--> statement-breakpoint
DROP INDEX IF EXISTS "dashboards_org_idx";
--> statement-breakpoint
CREATE INDEX "dashboards_workspace_idx" ON "dashboards" USING btree ("workspace_id");
