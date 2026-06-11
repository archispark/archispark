-- Rename the platform super-admin role value from "admin" to "platform_admin"
-- to disambiguate it from the per-organization "admin" role stored in
-- member.role. user.role is a free-text column (no enum constraint), so
-- existing rows need a data migration; new installs are seeded directly
-- with "platform_admin" by initUsers().
UPDATE "user" SET role = 'platform_admin' WHERE role = 'admin';
