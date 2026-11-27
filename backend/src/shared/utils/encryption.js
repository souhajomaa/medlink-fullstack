import crypto from 'crypto';
import { getSecret } from './secrets.js';

const RAW = String(getSecret('encryption_key'));
const KEY_V2 = crypto.createHash('sha256').update(RAW).digest();   // 32 octets exacts
const KEY_V1 = Buffer.from(crypto.createHash('sha256').update(RAW).digest('base64').slice(0, 32)); // ancien format

export function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY_V2, iv);
    const enc = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
    return ['v2', iv.toString('hex'), cipher.getAuthTag().toString('hex'), enc.toString('hex')].join(':');
}

export function decrypt(text) {
    if (text.startsWith('v2:')) {
        const [, iv, tag, data] = text.split(':');
        const d = crypto.createDecipheriv('aes-256-gcm', KEY_V2, Buffer.from(iv, 'hex'));
        d.setAuthTag(Buffer.from(tag, 'hex'));
        return Buffer.concat([d.update(Buffer.from(data, 'hex')), d.final()]).toString('utf8');
    }
    // Ancien format CBC (données déjà en base) : lecture seule
    const [iv, ...rest] = text.split(':');
    const d = crypto.createDecipheriv('aes-256-cbc', KEY_V1, Buffer.from(iv, 'hex'));
    return Buffer.concat([d.update(Buffer.from(rest.join(':'), 'hex')), d.final()]).toString('utf8');
}