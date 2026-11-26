#!/bin/sh
# Initialisation de Vault pour MedLink (US-45)
set -eu

i=0
until vault status >/dev/null 2>&1; do
  i=$((i+1)); [ "$i" -gt 30 ] && { echo "[vault-init] Vault injoignable"; exit 1; }
  sleep 2
done

for v in DB_PASSWORD JWT_SECRET ENCRYPTION_KEY KEYCLOAK_BACKEND_CLIENT_SECRET; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || { echo "[vault-init] Variable $v absente du .env"; exit 1; }
done

vault secrets list -format=json | grep -q '"secret/"' || vault secrets enable -path=secret -version=2 kv

vault kv put secret/medlink \
  db_password="$DB_PASSWORD" \
  jwt_secret="$JWT_SECRET" \
  encryption_key="$ENCRYPTION_KEY" \
  keycloak_backend_client_secret="$KEYCLOAK_BACKEND_CLIENT_SECRET" >/dev/null

# Policy minimale : lecture seule sur ce seul chemin
vault policy write medlink-backend - <<'POLICY'
path "secret/data/medlink" {
  capabilities = ["read"]
}
POLICY

# Token dédié au backend (jamais le root token)
mkdir -p /vault-token
vault token create -policy=medlink-backend -orphan -period=768h -display-name=medlink-backend \
  -field=token > /vault-token/backend.token
chmod 644 /vault-token/backend.token
echo "[vault-init] OK : secrets écrits, policy 'medlink-backend' créée, token backend émis."