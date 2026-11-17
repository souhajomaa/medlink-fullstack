-- Migration 003 : association des comptes de d?monstration avec Keycloak.

UPDATE users AS u
SET keycloak_id = v.kid::uuid
FROM (VALUES
  ('admin@medlink.tn',        '11111111-1111-4111-8111-000000000001'),
  ('patient@medlink.tn',      '11111111-1111-4111-8111-000000000002'),
  ('sara.patient@medlink.tn', '11111111-1111-4111-8111-000000000003'),
  ('doctor@medlink.tn',       '11111111-1111-4111-8111-000000000004'),
  ('pediatre@medlink.tn',     '11111111-1111-4111-8111-000000000005')
) AS v(email, kid)
WHERE lower(u.email) = v.email
  AND u.keycloak_id IS NULL;
