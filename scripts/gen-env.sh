#!/bin/sh
#git pull
 # Chaque membre fait ensuite : sh scripts/gen-env.sh
 #docker compose down -v && docker compose up -d --build
 #docker compose exec backend npm run seed
set -e
[ -f .env ] && { echo ".env existe déjà, rien modifié"; exit 1; }
r() { openssl rand -hex "$1"; }
cat > .env <<EOF
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=$(r 12)
KEYCLOAK_BACKEND_CLIENT_ID=medlink-backend
KEYCLOAK_BACKEND_CLIENT_SECRET=$(r 24)
KEYCLOAK_JWKS_URL=http://keycloak:8080/realms/medlink/protocol/openid-connect/certs
KEYCLOAK_ISSUER=http://localhost:8081/realms/medlink
VAULT_DEV_ROOT_TOKEN=$(r 16)
JWT_SECRET=$(r 32)
DB_PASSWORD=$(r 16)
ENCRYPTION_KEY=$(r 32)
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=noreply@medlink.local
SMTP_AUTH=false
EOF
echo ".env généré"