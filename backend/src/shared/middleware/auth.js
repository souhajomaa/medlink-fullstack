import { createRemoteJWKSet, jwtVerify } from 'jose';
import dotenv from 'dotenv';
import pool from '../utils/db.js';
import { hasOtp } from '../../modules/admin/keycloak.admin.js';

dotenv.config();

// Configuration de Keycloak
const JWKS_URL = process.env.KEYCLOAK_JWKS_URL;
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'medlink-app';

if (!JWKS_URL || !KEYCLOAK_ISSUER) {
  throw new Error(
    'Configuration Keycloak manquante : vérifie KEYCLOAK_JWKS_URL et KEYCLOAK_ISSUER'
  );
}

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

// MFA (US-17, US-34) : ces rôles doivent avoir un TOTP enregistré.
// Keycloak exige déjà l'OTP à la connexion (flow "browser-mfa") ; ce contrôle est une
// 2e barrière côté API. Résultat positif mis en cache 60 s.
const MFA_ROLES = ['practitioner', 'admin', 'patient'];
const mfaCache = new Map(); // keycloak_id -> expiration (ms)

export function invalidateMfaCache(keycloakId) {
  mfaCache.delete(keycloakId);
}

async function mfaSatisfied(user, keycloakId) {
  if (!MFA_ROLES.includes(user.role)) return true;
  if ((mfaCache.get(keycloakId) || 0) > Date.now()) return true;
  const ok = await hasOtp(keycloakId);
  if (ok) mfaCache.set(keycloakId, Date.now() + 60_000);
  return ok;
}

// Middleware d'authentification Keycloak
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token manquant'
    });
  }

  const token = header.substring(7).trim();

  try {
    // Vérifier la signature et la validité du JWT
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: KEYCLOAK_ISSUER,
      algorithms: ['RS256']
    });

    console.log('[AUTH] Token vérifié');
    console.log('[AUTH] Issuer :', payload.iss);
    console.log('[AUTH] Client :', payload.azp);  
    console.log('[AUTH] Subject présent :', !!payload.sub);

    // Vérifier que le token provient du client MedLink
    if (payload.azp !== KEYCLOAK_CLIENT_ID) {
      return res.status(401).json({
        error: 'Client non autorisé'
      });
    }

    if (!payload.sub) {
      return res.status(401).json({
        error: 'Identifiant Keycloak manquant'
      });
    }

    // Récupérer le profil utilisateur dans PostgreSQL
    const result = await pool.query(
      `SELECT id, email, full_name, role, specialty
       FROM users
       WHERE keycloak_id = $1`,
      [payload.sub]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: 'Compte Keycloak non associé à un profil MedLink'
      });
    }

    // MFA obligatoire (échec fermé si Keycloak est injoignable)
    let mfaOk;
    try {
      mfaOk = await mfaSatisfied(result.rows[0], payload.sub);
    } catch (e) {
      console.error('[auth] Vérification MFA impossible :', e.message);
      return res.status(503).json({
        error: 'Vérification MFA indisponible, réessayez'
      });
    }
    if (!mfaOk) {
      return res.status(403).json({
        error: 'Double authentification (TOTP) non configurée : reconnectez-vous pour la configurer',
        code: 'MFA_REQUIRED'
      });
    }

    // Attacher l'utilisateur à la requête
    req.user = result.rows[0];

    return next();

  } catch (err) {
      console.error('[auth] Erreur authentification :', err);
      console.error('[auth] Stack :', err.stack);

    return res.status(401).json({
      error: 'Token invalide ou expiré'
    });
  }
}

// Middleware de contrôle d'accès par rôle (RBAC)
// Exemple : requireRole('admin', 'practitioner')
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Accès non autorisé pour ce rôle'
      });
    }

    return next();
  };
}