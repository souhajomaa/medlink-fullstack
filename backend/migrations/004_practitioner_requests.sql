-- Migration 004 : demandes de compte praticien (validées ensuite par un administrateur).
-- Aucun compte Keycloak n'est créé à la demande : l'accès n'est ouvert qu'après validation.
CREATE TABLE IF NOT EXISTS practitioner_requests (
  id            SERIAL PRIMARY KEY,
  first_name    VARCHAR(50)  NOT NULL,
  last_name     VARCHAR(50)  NOT NULL,
  email         VARCHAR(255) NOT NULL,
  phone         VARCHAR(30)  NOT NULL,
  specialty     VARCHAR(100) NOT NULL,
  clinique_id   INTEGER REFERENCES cliniques(id) ON DELETE SET NULL,
  order_number  VARCHAR(30)  NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason TEXT,
  ip_address    VARCHAR(64),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Une seule demande en attente par adresse email.
CREATE UNIQUE INDEX IF NOT EXISTS practitioner_requests_pending_email_idx
  ON practitioner_requests (lower(email)) WHERE status = 'pending';
