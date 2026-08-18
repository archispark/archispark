-- First-boot only: seeds a single local admin/admin account so a fresh
-- install has a working login with no manual seed step (the credentials are
-- public in this file, hence must_change_password = true — enforced by
-- apps/server/proxy.ts, which redirects every page to /change-password
-- until it's cleared). Guarded by "users table is empty", so it never fires
-- again after this migration's first run, and never overwrites/duplicates
-- an existing account. Password hash is a precomputed argon2id encoding of
-- "admin" (packages/auth/src/local-password.ts's ARGON2_OPTIONS) — SQL has
-- no argon2 function to compute it inline.
INSERT INTO "users" ("id", "username", "email", "password_hash", "display_name", "role", "enabled", "email_verified", "must_change_password")
SELECT
  'local:' || gen_random_uuid(),
  'admin',
  'admin@archispark.internal',
  '$argon2id$v=19$m=19456,t=2,p=1$QF7z9MITO5LVerpMb8TuHg$HeSElfA5dmChoc1h4uTe1rNZPTu7OMEQICAYJUMEmaQ',
  'Admin',
  'platform_admin',
  true,
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM "users");
