BEGIN;

CREATE TABLE IF NOT EXISTS disponibilites (
    id SERIAL PRIMARY KEY,
    practitioner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinique_id INTEGER NOT NULL REFERENCES cliniques(id) ON DELETE CASCADE,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    heure_debut TIME NOT NULL,
    heure_fin TIME NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'disponible'
        CHECK (type IN ('disponible', 'bloque', 'absence')),
    motif TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_dates CHECK (date_fin >= date_debut),
    CONSTRAINT chk_heures CHECK (heure_fin > heure_debut)
);

CREATE INDEX IF NOT EXISTS idx_disponibilites_practitioner
    ON disponibilites(practitioner_id, date_debut, date_fin);

COMMIT;
