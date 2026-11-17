# 🏗️ US-57 : Stratégie d'Hébergement et Conformité INPDP

## 1. Contexte et Souveraineté des Données
Conformément à la loi organique n° 2004-63 relative à la protection des données personnelles et à la réglementation de l'**INPDP** (Instance Nationale de Protection des Données Personnelles) en Tunisie, les données de santé sont considérées comme des données sensibles. 

Pour MedLink, nous avons fait le choix stratégique d'héberger l'ensemble de l'infrastructure sur un **serveur VPS physiquement localisé en Tunisie** (Datacenter Tier III). Cela garantit une souveraineté totale des données, évite les transferts transfrontaliers non autorisés et assure une latence minimale pour les utilisateurs locaux (patients et praticiens).

## 2. Spécifications Techniques du VPS
Pour supporter la charge de l'application (React, Node.js, PostgreSQL, Keycloak) et assurer une haute disponibilité, l'infrastructure cible est dimensionnée comme suit :

- **Système d'exploitation** : Ubuntu Server 22.04 LTS (Support long terme, sécurité renforcée).
- **Processeur (vCPU)** : 4 vCPU (Optimisé pour les opérations I/O de Node.js et les requêtes concurrentes).
- **Mémoire vive (RAM)** : 8 Go (Nécessaire pour Keycloak (~2Go), PostgreSQL (~2Go) et le cache applicatif).
- **Stockage** : 80 Go NVMe SSD (Chiffré au repos via LUKS pour la sécurité physique des disques).
- **Réseau** : Bande passante 1 Gbps, 1 adresse IP publique fixe, pare-feu matériel en amont.

## 3. Architecture de Déploiement (DevSecOps)
L'application est déployée via une architecture conteneurisée (validée en US-56) orchestrée par **Docker Compose** :

1. **Reverse Proxy (Nginx)** : Exposé sur les ports 80 et 443. Il gère la terminaison SSL/TLS, la compression Gzip et le routage vers les conteneurs internes.
2. **Backend (Node.js/Express)** : Exposé uniquement sur le réseau interne Docker (port 4000 non exposé publiquement).
3. **Frontend (React/Vite)** : Servis par Nginx en mode statique pour des performances optimales.
4. **Base de données (PostgreSQL 16)** : Isolée dans le réseau Docker, aucun port public ouvert.
5. **IAM (Keycloak)** : Gère l'authentification et le MFA, isolé du réseau public.

## 4. Conformité Sécurité et INPDP
L'hébergement intègre nativement les exigences de sécurité du projet :

- **Chiffrement en transit (US-44)** : Certificats TLS 1.3 gérés via Let's Encrypt (Certbot) sur le reverse proxy Nginx. Redirection forcée HTTP -> HTTPS.
- **Chiffrement au repos (US-43)** : Les données sensibles (téléphones, diagnostics) sont chiffrées en AES-256-GCM au niveau applicatif avant insertion en base. Le disque du VPS est également chiffré.
- **Gestion des secrets (US-45)** : Aucun mot de passe en clair dans le code. Utilisation de Docker Secrets et de variables d'environnement injectées au runtime.
- **Durcissement du serveur (Hardening)** : 
  - Désactivation de l'authentification SSH par mot de passe (Clés RSA/Ed25519 uniquement).
  - Installation de `Fail2Ban` pour contrer les attaques par force brute sur le port SSH.
  - Configuration stricte de `UFW` (Uncomplicated Firewall) : seuls les ports 22 (SSH), 80 (HTTP) et 443 (HTTPS) sont ouverts.

## 5. Sauvegarde et Plan de Reprise (Lien US-37)
- **Sauvegardes** : Script `cron` quotidien exécutant `pg_dump` de la base PostgreSQL, chiffré via GPG, et envoyé sur un stockage objet S3 compatible local (ex: MinIO ou solution hébergeur local).
- **Rétention** : 30 jours glissants avec rotation automatique.
