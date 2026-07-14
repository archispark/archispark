CREATE TABLE "organization_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"expires_at" integer NOT NULL,
	"sent_at" integer,
	"accepted_at" integer,
	"revoked_at" integer
);
--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_invitations_token_hash_uniq" ON "organization_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "org_invitations_org_email_active_uniq" ON "organization_invitations" USING btree ("organization_id","email") WHERE accepted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "org_invitations_org_idx" ON "organization_invitations" USING btree ("organization_id");