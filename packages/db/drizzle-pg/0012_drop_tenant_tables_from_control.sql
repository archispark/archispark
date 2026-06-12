-- Phase 7: drop tenant-plane tables from the control database (archispark).
-- Tenant data now lives exclusively in the dedicated fallback database
-- (archispark_tenant) and in per-tenant Neon databases provisioned by Phase 3.
-- All tenant data must have been migrated (Phase 3 migration script) before
-- running this migration on an existing installation.
DROP TABLE IF EXISTS "bendpoints" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "connections" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "nodes" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "views" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "relationship_properties" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "element_properties" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "relationships" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "elements" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "property_definitions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "user_active_workspace" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "workspace_teams" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "workspaces" CASCADE;
