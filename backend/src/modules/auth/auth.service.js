import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../../shared/utils/db.js';
import { PRACTITIONER_SPECIALTIES } from '../../shared/utils/validators.js';
import {
    createKeycloakUser,
    assignRealmRole,
    sendVerifyEmail,
    deleteKeycloakUser,
    KeycloakError,
} from '../../shared/utils/keycloakAdmin.js';

export async function loginUser(email, password) {
    // 1. Chercher l'utilisateur par email
    const result = await pool.query(
        'SELECT id, email, password_hash, full_name, role, specialty FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
        throw new Error('Identifiants incorrects');
        // Note: Pour la sécurité (US-41), on dit toujours "Identifiants incorrects"
        // et jamais "Utilisateur non trouvé" pour ne pas révéler l'existence du compte.
    }

    const user = result.rows[0];

    // 2. Vérifier le mot de passe haché
    const valid = user.password_hash ? await bcrypt.compare(password, user.password_hash) : false;

    // 3. Générer le token JWT (US-40 : expiration 15min ou 24h selon .env)
    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            full_name: user.full_name,
            specialty: user.specialty
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // 4. Retourner les données sans le mot de passe
    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            specialty: user.specialty
        },
    };
}

export async function getUserById(userId) {
    const result = await pool.query(
        'SELECT id, email, full_name, role, specialty, phone FROM users WHERE id = $1',
        [userId]
    );
    if (result.rows.length === 0) throw new Error('Utilisateur non trouvé');
    return result.rows[0];
}

// ---------------------------------------------------------------------------
// Inscription patient (US-01) : Keycloak d'abord, puis le profil PostgreSQL.
// ---------------------------------------------------------------------------

export class RegistrationError extends Error {
    constructor(code) {
        super(code);
        this.name = 'RegistrationError';
        // CONFLICT : email déjà utilisé | REJECTED : refus de Keycloak | FAILED : erreur technique
        this.code = code;
    }
}

// Compensation : si le profil PostgreSQL n'a pas pu être créé, on supprime
// le compte Keycloak pour ne pas laisser d'identité sans profil.
async function rollbackKeycloakUser(keycloakId) {
    try {
        await deleteKeycloakUser(keycloakId);
    } catch (err) {
        console.error(
            `COMPTE KEYCLOAK ORPHELIN à supprimer manuellement : ${keycloakId} (${err.message})`
        );
    }
}


export async function registerPatient(values, ip) {
    const { firstName, lastName, email, phone, password } = values;

    const normalizedEmail = email.trim().toLowerCase();
    const fullName = `${firstName} ${lastName}`;

    // 1. Vérifier si l'utilisateur existe déjà dans PostgreSQL
    const existing = await pool.query(
        'SELECT 1 FROM users WHERE lower(email) = $1',
        [normalizedEmail]
    );

    if (existing.rows.length > 0) {
        throw new RegistrationError('CONFLICT');
    }

    let keycloakId;
    let newUserId;

    try {
        // 2. Créer le compte dans Keycloak
        console.log(`Création Keycloak pour ${normalizedEmail}...`);

        keycloakId = await createKeycloakUser({
            email: normalizedEmail,
            firstName,
            lastName,
            phone,
            password
        });

        console.log(`Utilisateur Keycloak créé : ${keycloakId}`);

        // 3. Attribuer le rôle patient dans Keycloak
        await assignRealmRole(keycloakId, 'patient');

        console.log('Rôle patient attribué dans Keycloak.');

        // 4. Générer le hash pour conserver la compatibilité
        // avec le login actuel basé sur bcrypt
        const passwordHash = await bcrypt.hash(password, 12);

        // 5. Créer le profil dans PostgreSQL
        const result = await pool.query(
            `INSERT INTO users
                (email, password_hash, full_name, role, phone, keycloak_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
                normalizedEmail,
                passwordHash,
                fullName,
                'patient',
                phone || null,
                keycloakId
            ]
        );

        newUserId = result.rows[0].id;

        console.log(`Profil PostgreSQL créé : ${newUserId}`);

    } catch (err) {
        // 6. En cas d'échec, supprimer le compte Keycloak
        if (keycloakId) {
            try {
                await rollbackKeycloakUser(keycloakId);
                console.log('Compte Keycloak supprimé après échec.');
            } catch (rollbackError) {
                console.error(
                    'Échec du rollback Keycloak :',
                    rollbackError.message
                );
            }
        }

        if (
            err instanceof KeycloakError &&
            err.status === 409
        ) {
            throw new RegistrationError('CONFLICT');
        }

        if (
            err instanceof KeycloakError &&
            err.status === 400
        ) {
            throw new RegistrationError('REJECTED');
        }

        if (err.code === '23505') {
            throw new RegistrationError('CONFLICT');
        }

        console.error('Erreur inscription :', err.message);
        throw new RegistrationError('FAILED');
    }

    // 7. Enregistrer l'action dans le journal d'audit
    try {
        await pool.query(
            `INSERT INTO journal_audit
                (utilisateur_id, action, ressource, adresse_ip)
             VALUES ($1, 'REGISTER', $2, $3)`,
            [
                newUserId,
                'Inscription patient',
                ip || null
            ]
        );
    } catch (err) {
        console.error(
            'Erreur journalisation :',
            err.message
        );
    }

    // 8. Envoyer l'email de vérification
    // Une erreur SMTP ne doit pas annuler le compte créé.
    try {
        await sendVerifyEmail(keycloakId);
        console.log('Email de vérification demandé à Keycloak.');
    } catch (err) {
        console.error(
            'Email de vérification non envoyé :',
            err.message
        );
    }

    return { id: newUserId };
}


// ---------------------------------------------------------------------------
// Demande de compte praticien : simple enregistrement en attente de validation.
// Aucun compte Keycloak ni profil `users` n'est créé ici.
// ---------------------------------------------------------------------------

export async function getPractitionerOptions() {
    const cliniques = await pool.query('SELECT id, nom, ville FROM cliniques ORDER BY nom');
    return { specialties: PRACTITIONER_SPECIALTIES, cliniques: cliniques.rows };
}

export async function createPractitionerRequest(values, ip) {
    const { firstName, lastName, email, phone, specialty, cliniqueId, orderNumber } = values;

    const clinique = await pool.query('SELECT 1 FROM cliniques WHERE id = $1', [cliniqueId]);
    if (clinique.rows.length === 0) {
        throw new RegistrationError('BAD_CLINIQUE');
    }

    // Email déjà utilisé par un compte : on ne le révèle pas (même réponse que pour une demande réussie).
    const existing = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (existing.rows.length > 0) {
        return { created: false };
    }

    // Une seule demande en attente par email (index unique) : un doublon est ignoré sans erreur.
    const inserted = await pool.query(
        `INSERT INTO practitioner_requests
            (first_name, last_name, email, phone, specialty, clinique_id, order_number, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [firstName, lastName, email, phone, specialty, cliniqueId, orderNumber, ip || null]
    );
    return { created: inserted.rows.length > 0 };
}
