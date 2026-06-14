-- Phase 4: organizations, their members/roles and invitations now live in
-- Keycloak (Phasetwo Organizations extension, see @workspace/auth's orgs.ts).
-- `organization_settings` replaces the local `organization.enabled` flag
-- (platform-admin "suspend" toggle, keyed by the Keycloak/Phasetwo org id).
CREATE TABLE "organization_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- teams/team_member/api_tokens/tenant_databases are re-keyed to plain
-- Keycloak organization/user ids (no FK: organizations and users now live in
-- Keycloak, not in this database).
ALTER TABLE "team" DROP CONSTRAINT IF EXISTS "team_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "team_member" DROP CONSTRAINT IF EXISTS "team_member_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "api_tokens" DROP CONSTRAINT IF EXISTS "api_tokens_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "api_tokens" DROP CONSTRAINT IF EXISTS "api_tokens_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "tenant_databases" DROP CONSTRAINT IF EXISTS "tenant_databases_organization_id_organization_id_fk";
--> statement-breakpoint
DROP TABLE IF EXISTS "member" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "invitation" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "organization" CASCADE;
