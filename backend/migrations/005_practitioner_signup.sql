-- Migration 005 : n° d'inscription à l'Ordre pour les praticiens (rejouable).
ALTER TABLE users ADD COLUMN IF NOT EXISTS order_number VARCHAR(30);
