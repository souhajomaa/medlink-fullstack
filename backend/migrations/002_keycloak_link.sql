-- Migration 002 : lien entre un profil MedLink et son compte Keycloak.
-- Non destructive et rejouable.

ALTER TABLE users ADD COLUMN IF NOT EXISTS keycloak_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS users_keycloak_id_idx
  ON users (keycloak_id) WHERE keycloak_id IS NOT NULL;
