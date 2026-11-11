import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// La clé doit faire exactement 32 caractères (256 bits) pour AES-256
// En production, cette clé viendra du Vault (US-45)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'MedLink2026SecretKeyForAES256!!!';
const IV_LENGTH = 16; // Pour l'algorithme AES, le vecteur d'initialisation doit faire 16 octets

/**
 * Chiffre une donnée sensible (US-43)
 * @param {string} text - La donnée en clair (ex: numéro de téléphone)
 * @returns {string} - La donnée chiffrée en base64 (iv:chiffre:tag)
 */
export function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // On retourne l'IV, le texte chiffré et le tag d'authentification, séparés par ':'
    return iv.toString('hex') + ':' + encrypted + ':' + cipher.getAuthTag().toString('hex');
}

/**
 * Déchiffre une donnée
 * @param {string} encryptedText - La donnée chiffrée (iv:chiffre:tag)
 * @returns {string} - La donnée en clair
 */
export function decrypt(encryptedText) {
    if (!encryptedText) return null;
    const textParts = encryptedText.split(':');
    if (textParts.length !== 3) return null; // Format invalide

    const iv = Buffer.from(textParts.shift(), 'hex');
    const encrypted = textParts.shift();
    const authTag = Buffer.from(textParts.shift(), 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}