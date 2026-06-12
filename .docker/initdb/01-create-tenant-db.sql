-- Creates the shared tenant fallback database (archispark_tenant).
-- Runs once on first Postgres container startup (empty data volume).
-- The archispark user (POSTGRES_USER) already exists; grant full access.
CREATE DATABASE archispark_tenant;
GRANT ALL PRIVILEGES ON DATABASE archispark_tenant TO archispark;
