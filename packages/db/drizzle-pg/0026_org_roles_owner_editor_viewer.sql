-- Renames organization role identifiers for clarity: "admin" -> "editor",
-- "member" -> "viewer" ("owner" is unchanged). Pure rename of stored values,
-- same permission matrix as before — see apps/server/lib/archimate/access.ts.
-- role is a free text column (no enum/constraint to alter). Idempotent: safe
-- to run against a database with no matching rows.
UPDATE "organization_members" SET "role" = 'editor' WHERE "role" = 'admin';
--> statement-breakpoint
UPDATE "organization_members" SET "role" = 'viewer' WHERE "role" = 'member';
--> statement-breakpoint
UPDATE "organization_invitations" SET "role" = 'editor' WHERE "role" = 'admin';
--> statement-breakpoint
UPDATE "organization_invitations" SET "role" = 'viewer' WHERE "role" = 'member';
