-- workspaces.organization_id, workspace_teams.team_id, and
-- user_active_workspace.user_id / organization_id reference control-plane
-- tables (organization, team, user). Once a tenant gets its own database
-- (Phase 3) cross-database foreign keys are impossible, so these become
-- plain unconstrained columns — referential integrity is enforced at the
-- application layer (see schema.tenant.ts).
ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "workspaces_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_teams" DROP CONSTRAINT IF EXISTS "workspace_teams_team_id_team_id_fk";
--> statement-breakpoint
ALTER TABLE "user_active_workspace" DROP CONSTRAINT IF EXISTS "user_active_workspace_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_active_workspace" DROP CONSTRAINT IF EXISTS "user_active_workspace_organization_id_organization_id_fk";
