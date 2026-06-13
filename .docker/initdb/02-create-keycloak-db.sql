-- Creates the Keycloak database (archispark_keycloak).
-- Runs once on first Postgres container startup (empty data volume).
-- The archispark user (POSTGRES_USER) already exists; grant full access.
CREATE DATABASE archispark_keycloak;
GRANT ALL PRIVILEGES ON DATABASE archispark_keycloak TO archispark;
