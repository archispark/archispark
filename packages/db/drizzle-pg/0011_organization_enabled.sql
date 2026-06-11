-- Platform admins can suspend an organization, blocking access for its
-- non-platform_admin members while leaving its data intact.
ALTER TABLE "organization" ADD COLUMN "enabled" boolean NOT NULL DEFAULT true;
