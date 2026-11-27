# Plan de tests et recette MedLink (US-62, US-64)

Exécution automatisée : `bash backend/tests/test-rbac.sh` (résultat : `docs/security/resultat-test-rbac.txt`).

## Tests automatisés (sécurité / RBAC)

| ID | Scénario | Attendu | Résultat |
|---|---|---|---|
| T01 | Route publique `/auth/practitioner-options` sans token | 200 | ✅ |
| T02 | `/auth/me` sans token | 401 | ✅ |
| T03 | `/patient/appointments` sans token | 401 | ✅ |
| T04 | `/practitioner/appointments` sans token | 401 | ✅ |
| T05 | `/admin/users` sans token | 401 | ✅ |
| T06 | Token aléatoire sur `/patient/appointments` | 401 | ✅ |
| T07 | Token HS256 forgé (« admin ») sur `/patient/appointments` | 401 | ✅ |
| T08 | Token `alg=none` sur `/patient/appointments` | 401 | ✅ |
| T09 | Token aléatoire sur `/practitioner/appointments` | 401 | ✅ |
| T10 | Token HS256 forgé sur `/practitioner/appointments` | 401 | ✅ |
| T11 | Token `alg=none` sur `/practitioner/appointments` | 401 | ✅ |
| T12 | Token aléatoire sur `/admin/users` | 401 | ✅ |
| T13 | Token HS256 forgé sur `/admin/users` | 401 | ✅ |
| T14 | Token `alg=none` sur `/admin/users` | 401 | ✅ |
| T15 | Ancien login `POST /auth/login` supprimé | 404 | ✅ |
| T16 | Patient → `/patient/appointments` | 200 | ✅ |
| T17 | Patient → `/practitioner/appointments` | 403 | ✅ |
| T18 | Patient → `/admin/users` | 403 | ✅ |
| T19 | Praticien → `/practitioner/appointments` | 200 | ✅ |
| T20 | Praticien → `/patient/appointments` | 403 | ✅ |
| T21 | Praticien → `/admin/users` | 403 | ✅ |
| T22 | Admin → `/admin/users` | 200 | À exécuter |
| T23 | Admin → `/patient/appointments` | 403 | À exécuter |
| T24 | Admin → `/practitioner/appointments` | 403 | À exécuter |

## Tests fonctionnels manuels (recette)

| ID | Scénario | Attendu | Résultat |
|---|---|---|---|
| F01 | Connexion patient avec mot de passe + TOTP | Tableau de bord affiché | À exécuter |
| F02 | Rechargement (F5) de la page connectée | Session conservée, pas d'écran blanc | À exécuter |
| F03 | Patient ouvre `/app/patients` | Redirection vers `/app` | À exécuter |
| F04 | Patient ouvre `/app/records` | « Mon dossier médical », sans filtre patient | À exécuter |
| F05 | Prise de rendez-vous par un patient | RDV visible dans « Mes rendez-vous » | À exécuter |
| F06 | Téléchargement du dossier médical en PDF | Fichier PDF téléchargé | À exécuter |
| F07 | Inscription praticien | Compte créé, e-mail de vérification dans Mailpit | À exécuter |
| F08 | Déconnexion | Retour à la page de connexion | À exécuter |
