#!/usr/bin/env bash
# US-62 : tests des scénarios RBAC (Keycloak RS256, MFA, client medlink-app)
#
# Partie A : aucun compte nécessaire (accès anonyme, tokens falsifiés, login legacy supprimé)
# Partie B : contrôle des rôles avec de vrais tokens Keycloak, fournis par variables
#            d'environnement (PATIENT_TOKEN, PRACTITIONER_TOKEN, ADMIN_TOKEN).
#            Une partie B sans token est ignorée (SKIP) et ne fait pas échouer le script.
#
# Usage : BASE_URL=http://localhost:3000/api bash backend/tests/test-rbac.sh

BASE_URL="${BASE_URL:-http://localhost:3000/api}"
PASS=0; FAIL=0; SKIP=0
# Ne garde que le token (ignore tout texte collé en trop)
clean() { printf '%s' "$1" | grep -o 'eyJ[A-Za-z0-9._-]*' | head -1; }
PATIENT_TOKEN=$(clean "$PATIENT_TOKEN")
PRACTITIONER_TOKEN=$(clean "$PRACTITIONER_TOKEN")
ADMIN_TOKEN=$(clean "$ADMIN_TOKEN")

check() { # description  code_attendu  code_obtenu
  if [ "$3" = "$2" ]; then
    echo "  ✅ $1 (HTTP $3)"; PASS=$((PASS+1))
  else
    echo "  ❌ $1 : attendu $2, reçu $3"; FAIL=$((FAIL+1))
  fi
}

http() { # méthode  chemin  [token]
  if [ -n "$3" ]; then
    curl -s -o /dev/null -w "%{http_code}" -X "$1" "$BASE_URL$2" -H "Authorization: Bearer $3"
  else
    curl -s -o /dev/null -w "%{http_code}" -X "$1" "$BASE_URL$2"
  fi
}

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

forge_hs256() { # faux token HS256 « admin » signé avec un secret deviné
  local h p s
  h=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  p=$(printf '{"sub":"attacker","role":"admin","azp":"medlink-app","exp":4102444800}' | b64url)
  s=$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "secret" -binary | b64url)
  echo "$h.$p.$s"
}

forge_none() { # faux token avec alg=none
  local h p
  h=$(printf '{"alg":"none","typ":"JWT"}' | b64url)
  p=$(printf '{"sub":"attacker","role":"admin","azp":"medlink-app","exp":4102444800}' | b64url)
  echo "$h.$p."
}

echo "🛡️  Tests RBAC MedLink (US-62) — cible : $BASE_URL"

echo
echo "── A1. Route publique"
check "GET /auth/practitioner-options sans token" 200 "$(http GET /auth/practitioner-options)"

echo
echo "── A2. Accès sans token (401 attendu)"
for route in /auth/me /patient/appointments /practitioner/appointments /admin/users; do
  check "GET $route" 401 "$(http GET $route)"
done

echo
echo "── A3. Tokens invalides ou falsifiés (401 attendu)"
for route in /patient/appointments /practitioner/appointments /admin/users; do
  check "token aléatoire sur $route" 401 "$(http GET $route "abc.def.ghi")"
  check "token HS256 forgé sur $route" 401 "$(http GET $route "$(forge_hs256)")"
  check "token alg=none sur $route" 401 "$(http GET $route "$(forge_none)")"
done

echo
echo "── A4. Ancien login supprimé (404 attendu)"
check "POST /auth/login" 404 "$(http POST /auth/login)"

echo
echo "── B. Contrôle des rôles avec de vrais tokens Keycloak"

if [ -n "$PATIENT_TOKEN" ]; then
  echo "  Patient :"
  check "patient → /patient/appointments (autorisé)" 200 "$(http GET /patient/appointments "$PATIENT_TOKEN")"
  check "patient → /practitioner/appointments (interdit)" 403 "$(http GET /practitioner/appointments "$PATIENT_TOKEN")"
  check "patient → /admin/users (interdit)" 403 "$(http GET /admin/users "$PATIENT_TOKEN")"
else
  echo "  ⏭️  SKIP patient (PATIENT_TOKEN absent)"; SKIP=$((SKIP+1))
fi

if [ -n "$PRACTITIONER_TOKEN" ]; then
  echo "  Praticien :"
  check "praticien → /practitioner/appointments (autorisé)" 200 "$(http GET /practitioner/appointments "$PRACTITIONER_TOKEN")"
  check "praticien → /patient/appointments (interdit)" 403 "$(http GET /patient/appointments "$PRACTITIONER_TOKEN")"
  check "praticien → /admin/users (interdit)" 403 "$(http GET /admin/users "$PRACTITIONER_TOKEN")"
else
  echo "  ⏭️  SKIP praticien (PRACTITIONER_TOKEN absent)"; SKIP=$((SKIP+1))
fi

if [ -n "$ADMIN_TOKEN" ]; then
  echo "  Admin :"
  check "admin → /admin/users (autorisé)" 200 "$(http GET /admin/users "$ADMIN_TOKEN")"
  check "admin → /patient/appointments (interdit)" 403 "$(http GET /patient/appointments "$ADMIN_TOKEN")"
  check "admin → /practitioner/appointments (interdit)" 403 "$(http GET /practitioner/appointments "$ADMIN_TOKEN")"
else
  echo "  ⏭️  SKIP admin (ADMIN_TOKEN absent)"; SKIP=$((SKIP+1))
fi

echo
echo "=============================================="
echo "Résultat : $PASS réussis, $FAIL échoués, $SKIP groupe(s) ignoré(s)"
[ "$FAIL" -eq 0 ]
