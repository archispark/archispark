-- Demo table backing the native Postgres dashboard datasource
-- (apps/server/lib/dashboards/datasource-executors/postgres.ts). Organization-
-- scoped like every business table, mirroring image_packs' organization_id
-- convention (0023_image_packs.sql) but NOT NULL: unlike system image packs,
-- this table has no "global" row — every fournisseur belongs to one organization.
CREATE TABLE "fournisseurs" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "nom" text NOT NULL,
  "actif" boolean DEFAULT true NOT NULL,
  "created_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE INDEX "fournisseurs_organization_idx" ON "fournisseurs" ("organization_id");
