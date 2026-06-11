CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"team_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_teams" (
	"workspace_id" integer NOT NULL,
	"team_id" text NOT NULL,
	CONSTRAINT "workspace_teams_workspace_id_team_id_pk" PRIMARY KEY("workspace_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "user_active_workspace" (
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"workspace_id" integer NOT NULL,
	CONSTRAINT "user_active_workspace_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "organization_id" text;
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_organization_id" text;
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_team_id" text;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "organization_id" text;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "workspace_id" integer;
--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_teams" ADD CONSTRAINT "workspace_teams_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_teams" ADD CONSTRAINT "workspace_teams_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_active_workspace" ADD CONSTRAINT "user_active_workspace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_active_workspace" ADD CONSTRAINT "user_active_workspace_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_active_workspace" ADD CONSTRAINT "user_active_workspace_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uniq" ON "organization" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX "team_organization_idx" ON "team" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "member_organization_idx" ON "member" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "member_user_idx" ON "member" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_uniq" ON "member" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX "team_member_team_idx" ON "team_member" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "team_member_user_idx" ON "team_member" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "invitation_organization_idx" ON "invitation" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "workspace_teams_team_idx" ON "workspace_teams" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "workspaces_organization_idx" ON "workspaces" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "api_tokens_organization_idx" ON "api_tokens" USING btree ("organization_id");
--> statement-breakpoint
INSERT INTO "organization" ("id", "name", "slug", "created_at")
SELECT 'default-org', 'Default', 'default', now()
WHERE EXISTS (SELECT 1 FROM "workspaces") OR EXISTS (SELECT 1 FROM "user")
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "workspaces" SET "organization_id" = 'default-org' WHERE "organization_id" IS NULL;
--> statement-breakpoint
INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
SELECT 'member-' || u."id", 'default-org', u."id",
       CASE WHEN u."role" = 'admin' THEN 'owner' ELSE 'member' END, now()
FROM "user" u
WHERE EXISTS (SELECT 1 FROM "organization" WHERE "id" = 'default-org')
ON CONFLICT ("organization_id","user_id") DO NOTHING;
--> statement-breakpoint
UPDATE "api_tokens" SET "organization_id" = 'default-org' WHERE "organization_id" IS NULL;
--> statement-breakpoint
INSERT INTO "user_active_workspace" ("user_id", "organization_id", "workspace_id")
SELECT u."id", 'default-org',
       COALESCE(
         (SELECT "id" FROM "workspaces" WHERE "is_active" = true AND "organization_id" = 'default-org' LIMIT 1),
         (SELECT "id" FROM "workspaces" WHERE "organization_id" = 'default-org' ORDER BY "id" LIMIT 1)
       )
FROM "user" u
WHERE EXISTS (SELECT 1 FROM "workspaces" WHERE "organization_id" = 'default-org')
ON CONFLICT ("user_id","organization_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "organization_id" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "workspaces_name_uniq";
--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_org_name_uniq" ON "workspaces" USING btree ("organization_id","name");
--> statement-breakpoint
ALTER TABLE "workspaces" DROP COLUMN "is_active";
--> statement-breakpoint
DROP TABLE IF EXISTS "user_roles";
--> statement-breakpoint
DROP TABLE IF EXISTS "role_layer_permissions";
--> statement-breakpoint
DROP TABLE IF EXISTS "roles";
