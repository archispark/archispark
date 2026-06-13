-- Bridges Keycloak `sub` claims to existing control-db users.id during the
-- Better Auth -> Keycloak migration (Stage 2). NULL for users not yet
-- provisioned in Keycloak.
ALTER TABLE "user" ADD COLUMN "keycloak_sub" text;--> statement-breakpoint
CREATE UNIQUE INDEX "user_keycloak_sub_uniq" ON "user" ("keycloak_sub");
