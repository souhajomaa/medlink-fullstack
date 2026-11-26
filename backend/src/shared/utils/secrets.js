import fs from 'fs';

const cache = new Map();   // alimenté par loadSecrets() depuis Vault

export function setSecrets(obj = {}) {
    for (const [k, v] of Object.entries(obj)) cache.set(k.toLowerCase(), String(v));
}

// Ordre : 1) Vault  2) Docker Secret /run/secrets/<nom>  3) variable d'env (dev local)
export function getSecret(secretName) {
    const name = secretName.toLowerCase();
    if (cache.has(name)) return cache.get(name);
    const secretPath = `/run/secrets/${name}`;
    try {
        if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, 'utf8').trim();
    } catch {
        console.warn(`⚠️ Impossible de lire le secret ${name}, fallback sur .env`);
    }
    return process.env[name.toUpperCase()] || '';
}

function readVaultToken() {
    const file = process.env.VAULT_TOKEN_FILE;
    if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    return (process.env.VAULT_TOKEN || '').trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function loadSecrets() {
    const addr = (process.env.VAULT_ADDR || '').replace(/\/$/, '');
    const required = process.env.VAULT_REQUIRED === 'true';
    if (!addr) {
        console.warn('⚠️ VAULT_ADDR non défini : secrets lus depuis Docker Secrets / .env (mode local)');
        return;
    }
    const path = process.env.VAULT_SECRET_PATH || 'secret/data/medlink';
    let lastErr;

    for (let attempt = 1; attempt <= 15; attempt++) {
        try {
            const token = readVaultToken();
            if (!token) throw new Error('aucun token Vault (VAULT_TOKEN_FILE / VAULT_TOKEN)');
            const res = await fetch(`${addr}/v1/${path}`, {
                headers: { 'X-Vault-Token': token },
                signal: AbortSignal.timeout(5000),
            });
            if (res.status === 403) throw new Error('403 : token refusé ou policy insuffisante');
            if (res.status === 404) throw new Error(`404 : secret ${path} introuvable (vault-init a-t-il tourné ?)`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = (await res.json())?.data?.data;
            if (!data || !Object.keys(data).length) throw new Error('secret vide');

            setSecrets(data);
            if (data.jwt_secret) process.env.JWT_SECRET = data.jwt_secret;
            if (data.keycloak_backend_client_secret) {
                process.env.KEYCLOAK_BACKEND_CLIENT_SECRET = data.keycloak_backend_client_secret;
            }
            console.log(`🔐 ${Object.keys(data).length} secrets chargés depuis Vault (${addr})`);
            return;
        } catch (err) {
            lastErr = err;
            console.warn(`⏳ Vault indisponible (essai ${attempt}/15) : ${err.message}`);
            await sleep(2000);
        }
    }
    if (required) {
        console.error(`❌ Impossible de lire les secrets dans Vault : ${lastErr?.message}. Arrêt du backend.`);
        process.exit(1);
    }
    console.warn('⚠️ Vault injoignable : repli sur Docker Secrets / .env');
}