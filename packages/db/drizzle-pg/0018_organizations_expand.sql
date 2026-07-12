-- Organizations expand step (expand/backfill/verify/contract, see plan.md
-- Phase 2). Adds the Organization → Workspace hierarchy without breaking
-- existing rows: workspaces.organization_id and api_tokens.organization_id
-- are added NULLABLE here and populated by the idempotent backfill
-- (packages/db/src/backfill-organizations.ts, run automatically right after
-- migrations at every app startup). A later, separate migration
-- (0019_organizations_contract.sql) adds the NOT NULL constraint once the
-- backfill has been verified in the target environment — see
-- docs/deployment.md.
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_personal" boolean DEFAULT false NOT NULL,
	"personal_owner_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_active_organization" (
	"user_id" text PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspaces" RENAME COLUMN "owner_id" TO "created_by_id";
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "organization_id" integer;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspaces_owner_name_uniq";
--> statement-breakpoint
DROP INDEX IF EXISTS "workspaces_owner_idx";
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "organization_id" integer;
--> statement-breakpoint
-- user_active_workspace gains a per-organization PK; existing pointers are
-- not worth migrating (they self-heal on the next request via
-- resolveActiveContext's fallback, see access.ts) so the table is recreated.
DROP TABLE IF EXISTS "user_active_workspace" CASCADE;
--> statement-breakpoint
CREATE TABLE "user_active_workspace" (
	"user_id" text NOT NULL,
	"organization_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	CONSTRAINT "user_active_workspace_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_active_organization" ADD CONSTRAINT "user_active_organization_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_active_workspace" ADD CONSTRAINT "user_active_workspace_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_active_workspace" ADD CONSTRAINT "user_active_workspace_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uniq" ON "organizations" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_personal_owner_uniq" ON "organizations" USING btree ("personal_owner_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_uniq" ON "organization_members" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX "org_members_org_idx" ON "organization_members" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "org_members_user_idx" ON "organization_members" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_org_name_uniq" ON "workspaces" USING btree ("organization_id","name");
--> statement-breakpoint
CREATE INDEX "workspaces_org_idx" ON "workspaces" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "api_tokens_organization_idx" ON "api_tokens" USING btree ("organization_id");
