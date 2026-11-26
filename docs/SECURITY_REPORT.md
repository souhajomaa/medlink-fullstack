## Risques résiduels documentés (US-61)

### Keycloak Admin Console (localhost:8081)
- **Alertes ZAP** : CSP unsafe-inline, Wildcard directive
- **Analyse** : Ces directives CSP sont nécessaires au fonctionnement de l'interface
  d'administration Keycloak (React + inline scripts). Ce n'est pas une faille
  applicative MedLink mais une limitation du logiciel tiers.
- **Mitigation** : L'admin console n'est exposée QUE sur localhost (réseau interne
  Docker), jamais en production publique. Accès protégé par MFA (US-17, US-34).
- **Décision** : Risque résiduel ACCEPTÉ, consigné dans la checklist OWASP (US-59).

### Apache Fedora (localhost:80)
- **Alerte** : Server Leaks Version (Apache/2.4.68)
- **Analyse** : Ce serveur Apache est celui du système Fedora, il ne sert PAS
  l'application MedLink (qui tourne sur Nginx:3000 et Node:4000).
- **Mitigation** : En production, le port 80 sera derrière un reverse proxy
  avec `ServerTokens Prod` (déjà appliqué dans nginx.conf).
- **Décision** : Hors périmètre applicatif, ignoré.

## US-60 / US-61 : Scan OWASP ZAP (rapport : docs/security/zap-report.html)

| Alerte | Avant | Après | Décision |
|---|---|---|---|
| CSP Header Not Set | Oui | Corrigé | CSP nginx (security-headers.conf) |
| Missing Anti-clickjacking | Oui | Corrigé | X-Frame-Options + frame-ancestors |
| X-Content-Type-Options Missing | Oui | Corrigé | nosniff |
| Server version leak | Oui | Corrigé | server_tokens off |
| script-src unsafe-inline / unsafe-eval | Oui | Corrigé | script-src 'self' |
| SRI (Google Fonts) | Oui | Corrigé | polices hébergées localement (@fontsource) |
| style-src unsafe-inline | Oui | Accepté | styles inline de React |
| Alertes sur :8081 et localhost | Oui | Hors périmètre | Keycloak / serveur Apache de la machine de test |
| Suspicious Comments | Info | Faux positif | mot « select » dans le bundle minifié |
