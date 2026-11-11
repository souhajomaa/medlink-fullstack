import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose';
import pool from '../utils/db.js';

dotenv.config();

/**
 * Middleware d'authentification - utilisé par TOUS les modules.
 *
 * Deux types de tokens sont acceptés pendant la migration vers Keycloak :
 *  1. Token Keycloak (RS256) : signature vérifiée via les clés publiques (JWKS) du realm.
 *     Le rôle vient de realm_access.roles ; le profil local (users) est rattaché via keycloak_id.
 *  2. Token historique (HS256, JWT_SECRET) émis par /api/auth/login. A désactiver avec
 *     ALLOW_LEGACY_AUTH=false quand M1 aura migré le login du frontend vers Keycloak.
 *
 * Dans les deux cas, req.user = { id, email, role, full_name, specialty } où id = users.id (entier local),
 * ce qui garde les clés étrangères (rendez-vous, dossiers...) inchangées pour les autres modules.
 */
const KC_URL = (process.env.KEYCLOAK_URL || '').replace(/\/$/, '');
// URL publique de Keycloak (celle vue par le navigateur) : c'est elle qui figure dans le claim "iss".
// En Docker, KEYCLOAK_URL = http://keycloak:8080 (réseau interne) et KEYCLOAK_PUBLIC_URL = http://localhost:8080.
const KC_PUBLIC_URL = (process.env.KEYCLOAK_PUBLIC_URL || KC_URL).replace(/\/$/, '');
const KC_REALM = process.env.KEYCLOAK_REALM || 'medlink';
const ISSUER = KC_PUBLIC_URL ? `${KC_PUBLIC_URL}/realms/${KC_REALM}` : null;
const jwks = KC_URL ? createRemoteJWKSet(new URL(`${KC_URL}/realms/${KC_REALM}/protocol/openid-connect/certs`)) : null;

// Un compte n'a qu'un seul rôle applicatif (garanti par l'API admin). Si plusieurs apparaissent
// (modification directe dans la console Keycloak), on retient le plus élevé. Sans rôle : patient (moindre privilège).
const APP_ROLES = ['admin', 'practitioner', 'patient'];
const pickRole = (roles = []) => APP_ROLES.find((r) => roles.includes(r)) || 'patient';

const PROFILE = 'id, email, full_name, role, specialty';

async function resolveLocalUser(claims) {
    const role = pickRole(claims.realm_access?.roles);
    const email = String(claims.email || '').toLowerCase();
    const fullName =
        claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ') || email;

    let row = (await pool.query(`SELECT ${PROFILE} FROM users WHERE keycloak_id = $1`, [claims.sub])).rows[0];

    // Compte local existant (ex. seed) : rattachement par e-mail, uniquement si l'e-mail est vérifié
    // côté Keycloak (sinon quelqu'un pourrait s'inscrire avec l'e-mail d'un autre et récupérer son profil).
    if (!row && email && claims.email_verified === true) {
        row = (
            await pool.query(
                `UPDATE users SET keycloak_id = $1 WHERE email = $2 AND keycloak_id IS NULL RETURNING ${PROFILE}`,
                [claims.sub, email]
            )
        ).rows[0];
    }

    // Premier passage (ex. auto-inscription d'un patient) : création du profil local
    if (!row) {
        row = (
            await pool.query(
                `INSERT INTO users (email, full_name, role, keycloak_id) VALUES ($1, $2, $3, $4)
         ON CONFLICT (keycloak_id) DO UPDATE SET keycloak_id = EXCLUDED.keycloak_id
         RETURNING ${PROFILE}`,
                [email, fullName, role, claims.sub]
            )
        ).rows[0];
    }

    // Le token est la source de vérité pour le rôle : on resynchronise le cache local
    if (row.role !== role) {
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, row.id]);
        row.role = role;
    }

    return { ...row, keycloak_id: claims.sub };
}

export async function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant' });
    }

    const token = header.split(' ')[1];

    try {
        const { alg } = decodeProtectedHeader(token);

        if (alg === 'HS256') {
            if (process.env.ALLOW_LEGACY_AUTH === 'false' || !process.env.JWT_SECRET) {
                throw new Error('Authentification historique désactivée');
            }
            req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
            return next();
        }

        if (!jwks) throw new Error('Keycloak non configuré (KEYCLOAK_URL)');
        const { payload } = await jwtVerify(token, jwks, { issuer: ISSUER, algorithms: ['RS256'] });
        req.user = await resolveLocalUser(payload);
        next();
    } catch (err) {
        console.warn('[auth] token refusé :', err.message);
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

/**
 * Middleware de contrôle d'accès par rôle (RBAC)
 * Exemple : requireRole('admin', 'practitioner')
 */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès non autorisé pour ce rôle' });
        }
        next();
    };
}