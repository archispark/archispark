-- Control-plane demo seed: organizations + members for ArchiSurance and ArchiMetal.
-- Runs against the control DB (DATABASE_URL). Tenant content is in demo.sql.
DO $$
DECLARE
  org_id TEXT;
BEGIN
  -- ArchiSurance
  INSERT INTO organization (id, name, slug, created_at)
    VALUES ('org-archisurance', 'ArchiSurance', 'archisurance', NOW())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO org_id;

  INSERT INTO member (id, organization_id, user_id, role, created_at)
  SELECT 'member-' || org_id || '-' || u.id, org_id, u.id,
         CASE WHEN u.role = 'platform_admin' THEN 'owner' ELSE 'member' END, NOW()
  FROM "user" u
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- ArchiMetal
  INSERT INTO organization (id, name, slug, created_at)
    VALUES ('org-archimetal', 'ArchiMetal', 'archimetal', NOW())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO org_id;

  INSERT INTO member (id, organization_id, user_id, role, created_at)
  SELECT 'member-' || org_id || '-' || u.id, org_id, u.id,
         CASE WHEN u.role = 'platform_admin' THEN 'owner' ELSE 'member' END, NOW()
  FROM "user" u
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END $$;
