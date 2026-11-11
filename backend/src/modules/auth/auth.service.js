import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../../shared/utils/db.js';

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