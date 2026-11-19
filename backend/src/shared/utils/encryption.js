
import crypto from 'crypto';
import dotenv from 'dotenv';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
    path: path.resolve(__dirname, '../../../../.env')
});

// Clé AES-256 : 32 octets exactement
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || !/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    throw new Error(
        'ENCRYPTION_KEY doit contenir exactement 64 caractères hexadécimaux.'
    );
}

const KEY = Buffer.from(ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Chiffrement AES-256-GCM
 */
export function encrypt(text) {
    if (text === null || text === undefined || text === '') {
        return null;
    }

    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);

    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return [
        iv.toString('hex'),
        encrypted,
        cipher.getAuthTag().toString('hex')
    ].join(':');
}

/**
 * Déchiffrement AES-256-GCM
 * Compatible avec les anciens IV de 16 octets.
 */
export function decrypt(encryptedText) {
    if (!encryptedText) return null;

    try {
        const parts = encryptedText.split(':');

        if (parts.length !== 3) return null;

        const [ivHex, encrypted, authTagHex] = parts;

        if (
            !/^(?:[0-9a-fA-F]{2})+$/.test(ivHex) ||
            !/^(?:[0-9a-fA-F]{2})*$/.test(encrypted) ||
            !/^(?:[0-9a-fA-F]{2})+$/.test(authTagHex)
        ) {
            return null;
        }

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        if (
            ![IV_LENGTH, LEGACY_IV_LENGTH].includes(iv.length) ||
            authTag.length !== AUTH_TAG_LENGTH
        ) {
            return null;
        }

        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            KEY,
            iv
        );

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;

    } catch (error) {
        console.error('Échec du déchiffrement AES-GCM.');
        return null;
    }
}
