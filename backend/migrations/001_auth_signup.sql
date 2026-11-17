-- Migration 001 : inscription patient via Keycloak
-- Non destructive et rejouable : aucune donnee n'est modifiee ni supprimee.

-- Les mots de passe sont geres par Keycloak : un profil cree a l'inscription
-- n'a pas de mot de passe local.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Unicite de l'email sans tenir compte de la casse.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
