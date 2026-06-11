CREATE TABLE "tenant_databases" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"neon_project_id" text,
	"neon_database_name" text NOT NULL,
	"neon_role_name" text NOT NULL,
	"connection_string_encrypted" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"region" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_databases" ADD CONSTRAINT "tenant_databases_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tenant_databases_status_idx" ON "tenant_databases" USING btree ("status");
--> statement-breakpoint
-- workspaces will live in a separate per-tenant database (Phase 3); a
-- cross-database foreign key is not possible, so this becomes a plain
-- unconstrained column (still validated at the application layer).
ALTER TABLE "api_tokens" DROP CONSTRAINT IF EXISTS "api_tokens_workspace_id_workspaces_id_fk";
