-- Phase 6: final cleanup of the Better Auth -> Keycloak (Phasetwo) migration.
-- Identities and IdP configuration now live entirely in Keycloak; these
-- tables (and their FKs, already dropped in 0015) are no longer used.
DROP TABLE IF EXISTS "session" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "account" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "verification" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "user" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "oauth_providers" CASCADE;
