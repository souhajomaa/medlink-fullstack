
// Client minimal de l'Admin API Keycloak.
// Utilise le client technique "medlink-backend" (service account, droits limités).
// Jamais les identifiants administrateur. Le secret ne quitte jamais le backend.

export class KeycloakError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'KeycloakError';
    this.status = status;
  }
}

const TIMEOUT_MS = 10000;

const baseUrl = () => process.env.KEYCLOAK_URL;
const realm = () => process.env.KEYCLOAK_REALM || 'medlink';

let cachedToken = { value: null, expiresAt: 0 };

// Actions obligatoires pour tous les rôles
const DEFAULT_REQUIRED_ACTIONS = [
  'VERIFY_EMAIL',
  'CONFIGURE_TOTP',
];

async function getServiceToken() {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 10000) {
    return cachedToken.value;
  }

  const res = await fetch(
    `${baseUrl()}/realms/${realm()}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KEYCLOAK_BACKEND_CLIENT_ID,
        client_secret: process.env.KEYCLOAK_BACKEND_CLIENT_SECRET,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );

  if (!res.ok) {
    throw new KeycloakError(
      'Authentification du service Keycloak impossible',
      res.status
    );
  }

  const data = await res.json();

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.value;
}

async function adminFetch(path, options = {}, retry = true) {
  const token = await getServiceToken();

  const res = await fetch(
    `${baseUrl()}/admin/realms/${realm()}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  );

  // Renouveler le token une seule fois en cas d'expiration.
  if (res.status === 401 && retry) {
    cachedToken = { value: null, expiresAt: 0 };
    return adminFetch(path, options, false);
  }

  return res;
}

// Créer un utilisateur dans Keycloak.
// Le mot de passe est transmis à Keycloak, qui le hache.
// Il n'est jamais conservé par cette fonction.
//
// Tous les rôles doivent vérifier leur email et configurer le TOTP.
export async function createKeycloakUser({
  email,
  firstName,
  lastName,
  phone,
  password,
  requiredActions = DEFAULT_REQUIRED_ACTIONS,
}) {
  const res = await adminFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      username: email,
      email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: false,
      attributes: {
        phone: [phone],
      },
      credentials: [
        {
          type: 'password',
          value: password,
          temporary: false,
        },
      ],
      requiredActions,
    }),
  });

  if (res.status === 201) {
    const location = res.headers.get('location') || '';
    const id = location.split('/').pop();

    if (!id) {
      throw new KeycloakError(
        'Identifiant Keycloak introuvable',
        500
      );
    }

    return id;
  }

  const details = await res.text();

  console.error('Détail du refus Keycloak :', details);

  throw new KeycloakError(
    `Création Keycloak refusée (${res.status})`,
    res.status
  );
}

// Attribuer un rôle Realm à l'utilisateur.
export async function assignRealmRole(userId, roleName) {
  const roleRes = await adminFetch(
    `/roles/${encodeURIComponent(roleName)}`
  );

  if (!roleRes.ok) {
    throw new KeycloakError(
      `Rôle Keycloak introuvable (${roleRes.status})`,
      roleRes.status
    );
  }

  const role = await roleRes.json();

  const res = await adminFetch(
    `/users/${userId}/role-mappings/realm`,
    {
      method: 'POST',
      body: JSON.stringify([
        {
          id: role.id,
          name: role.name,
        },
      ]),
    }
  );

  if (!res.ok) {
    throw new KeycloakError(
      `Attribution du rôle refusée (${res.status})`,
      res.status
    );
  }
}

// Envoyer l'email de vérification.
export async function sendVerifyEmail(userId) {
  const params = new URLSearchParams({
    client_id: 'medlink-app',
    redirect_uri: `${
      process.env.FRONTEND_URL || 'http://localhost:3000'
    }/login`,
  });

  const res = await adminFetch(
    `/users/${userId}/send-verify-email?${params}`,
    {
      method: 'PUT',
    }
  );

  if (!res.ok) {
    throw new KeycloakError(
      `Envoi de l'email refusé (${res.status})`,
      res.status
    );
  }
}

// Supprimer un utilisateur Keycloak.
// Utilisé notamment lors du rollback d'une inscription échouée.
export async function deleteKeycloakUser(userId) {
  const res = await adminFetch(
    `/users/${userId}`,
    {
      method: 'DELETE',
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new KeycloakError(
      `Suppression Keycloak refusée (${res.status})`,
      res.status
    );
  }
}
