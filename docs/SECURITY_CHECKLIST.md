# 🛡️ Checklist de Sécurité OWASP Top 10 (2021) - Projet MedLink

Ce document assure la traçabilité des exigences de sécurité (DevSecOps) par rapport aux risques OWASP et aux User Stories du projet MedLink, conformément à la loi INPDP.

| # | Risque OWASP Top 10 | User Stories Couvertes | Implémentation Technique dans MedLink | Statut | Responsable |
|---|---|---|---|:---:|:---:|
| **A01** | **Contrôle d'accès défaillant** *(Broken Access Control)* | US-39, US-13, US-22 | Middlewares `authenticate` et `requireRole`. Vérification stricte `practitioner_id` / `patient_id` en base. | ✅ Fait | Souha / Aya |
| **A02** | **Défaillances cryptographiques** *(Cryptographic Failures)* | US-43, US-44, US-14 | Chiffrement AES-256-GCM (`encryption.js`) pour les données au repos. HTTPS/TLS imposé. | ✅ Fait | Souha |
| **A03** | **Injection** | US-05, US-23, US-47 | Utilisation exclusive de requêtes paramétrées (`pool.query` avec `$1, $2`) pour éviter les injections SQL. | ✅ Fait | Tous |
| **A04** | **Conception non sécurisée** *(Insecure Design)* | US-40, US-41, US-42 | Session timeout 15 min (`SessionTimeout.jsx`), Anti-brute-force et politique MDP (gérés par Keycloak). | 🟡 En cours | Hanen / Mehdi |
| **A05** | **Mauvaise configuration de sécurité** | US-45, US-58 | Secrets hors du code (`.env.example`), CI/CD GitHub Actions, pas de données sensibles dans Git. | ✅ Fait | Souha |
| **A06** | **Composants vulnérables et obsolètes** | US-58, US-61 | `npm audit` intégré dans le pipeline CI, mise à jour régulière des dépendances (`package-lock.json`). | ✅ Fait | Souha |
| **A07** | **Défaillances d'identification et d'authentification** | US-17, US-34, US-02 | Authentification centralisée via Keycloak + MFA (TOTP) obligatoire pour Praticiens et Admins. | 🟡 En cours | Mehdi / Hanen |
| **A08** | **Défaillances de l'intégrité des données** | US-37, US-46 | Sauvegardes chiffrées de la base + Anonymisation stricte des exports statistiques (US-32, US-46). | 🟡 En cours | Mehdi |
| **A09** | **Défaillances de la journalisation et de la surveillance** | US-35, US-47, US-48 | Middleware `audit-logger.js` traçant chaque accès aux dossiers + Worker de rappels automatisé. | ✅ Fait | Souha / Ons |
| **A10** | **Falsification de requête côté serveur (SSRF)** | US-14, US-25 | Validation stricte des chemins de fichiers et des origines de requêtes avant tout téléchargement. | 🟡 À vérifier | Souha |

---
### 📋 Conformité Réglementaire (INPDP - Tunisie)
- [x] **Consentement explicite** (US-04)
- [x] **Droit d'accès et de portabilité** (US-13, US-16)
- [x] **Minimisation des données** (US-46 : exports anonymisés, pas de données nominatives)
- [x] **Traçabilité des accès** (US-47 : journal d'audit immuable consultable par l'admin US-35)
- [x] **Résidence des données** (US-57 : Hébergement VPS en Tunisie)

*Dernière mise à jour : Novembre 2026 par l'équipe DevSecOps (Souha).*
