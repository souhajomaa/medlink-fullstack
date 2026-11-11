import dotenv from 'dotenv';
import { HttpError } from './http-error.js';

dotenv.config();

/**
 * Client minimal de l'API Admin de Keycloak (US-12, US-13).
 * Le backend s'authentifie avec le client confidentiel "medlink-admin-api" (service account,
 * flux client_credentials) : il n'utilise JAMAIS le token de l'admin connecté, et ce client ne
 * possède que les rôles realm-management nécessaires (manage-users, view-users, query-users, view-realm).
 */
const BASE = (process.env.KEYCLOAK_URL || '').replace(/\/$/, '');
const REALM = process.env.KEYCLOAK_REALM || 'medlink';
export const APP_ROLES = ['patient', 'practitioner', 'admin'];

let cached = { token: null, expiresAt: 0 };

async function serviceToken() {
    if (cached.token && Date.now() < cached.expiresAt) return cached.token;
    if (!BASE) throw new HttpError(503, 'Keycloak non configuré (variable KEYCLOAK_URL)');

    const res = await fetch(`${BASE}/realms/${REALM}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'medlink-admin-api',
            client_secret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '',
        }),
    }).catch(() => null);

    if (!res || !res.ok) throw new HttpError(502, "Authentification du backend auprès de Keycloak impossible");
    const data = await res.json();
    cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 15) * 1000 };
    return cached.token;
}

async function kc(path, { method = 'GET', body, raw = false } = {}) {
    const token = await serviceToken();
    const res = await fetch(`${BASE}/admin/realms/${REALM}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);

    if (!res) throw new HttpError(502, 'Keycloak injoignable');
    if (res.status === 401) cached = { token: null, expiresAt: 0 };
    if (res.status === 409) throw new HttpError(409, 'Cette adresse e-mail existe déjà dans Keycloak');
    if (res.status === 404) throw new HttpError(404, 'Compte introuvable dans Keycloak');
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[keycloak]', method, path, res.status, text);
        // 400 = règle refusée (ex. politique de mot de passe) : on remonte le message à l'admin
        let detail = null;
        try { detail = JSON.parse(text).errorMessage; } catch { /* corps non JSON */ }
        throw new HttpError(res.status === 400 ? 400 : 502, detail || `Erreur Keycloak (${res.status})`);
    }
    if (raw) return res;
    return res.status === 204 ? null : res.json().catch(() => null);
}

export async function createUser({ email, firstName, lastName, password, requiredActions }) {
    const res = await kc('/users', {
        method: 'POST',
        raw: true,
        body: {
            username: email,
            email,
            firstName,
            lastName,
            enabled: true,
            emailVerified: true,
            requiredActions, // l'utilisateur doit changer son mot de passe (et configurer le TOTP) à la 1re connexion
            credentials: [{ type: 'password', value: password, temporary: true }],
        },
    });
    const id = res.headers.get('location')?.split('/').pop();
    if (!id) throw new HttpError(502, "Keycloak n'a pas renvoyé l'identifiant du compte créé");
    return id;
}

export const deleteUser = (id) => kc(`/users/${id}`, { method: 'DELETE' });
export const getUser = (id) => kc(`/users/${id}`);
export const listAllUsers = () => kc('/users?max=1000');
export const listRoleMembers = (role) => kc(`/roles/${encodeURIComponent(role)}/users?max=1000`);

// PUT /users/{id} avec une représentation partielle est rejeté par le "user profile" de Keycloak :
// on relit le compte puis on renvoie la représentation complète modifiée.
async function putMerged(id, patch) {
    const current = await getUser(id);
    await kc(`/users/${id}`, { method: 'PUT', body: { ...current, ...patch } });
}

export const updateName = (id, { firstName, lastName }) => putMerged(id, { firstName, lastName });

export async function setEnabled(id, enabled) {
    await putMerged(id, { enabled });
    if (!enabled) await kc(`/users/${id}/logout`, { method: 'POST' }); // coupe les sessions ouvertes
}

export const resetPassword = (id, password) =>
    kc(`/users/${id}/reset-password`, {
        method: 'PUT',
        body: { type: 'password', value: password, temporary: true },
    });

/**
 * US-13 : un compte n'a qu'UN rôle applicatif. On retire les autres rôles applicatifs puis on pose le nouveau,
 * et on coupe les sessions pour que le nouveau rôle soit pris en compte à la prochaine connexion.
 */
export async function setUserRole(id, role) {
    const [target, current] = await Promise.all([
        kc(`/roles/${encodeURIComponent(role)}`),
        kc(`/users/${id}/role-mappings/realm`),
    ]);
    const toRemove = current.filter((r) => APP_ROLES.includes(r.name) && r.name !== role);
    if (toRemove.length) await kc(`/users/${id}/role-mappings/realm`, { method: 'DELETE', body: toRemove });
    if (!current.some((r) => r.name === role)) {
        await kc(`/users/${id}/role-mappings/realm`, { method: 'POST', body: [target] });
    }
    if (toRemove.length) await kc(`/users/${id}/logout`, { method: 'POST' });
}