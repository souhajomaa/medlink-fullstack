
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const { default: pool } = await import('./src/shared/utils/db.js');
const { decrypt } = await import('./src/shared/utils/encryption.js');

try {
    const result = await pool.query(`
        SELECT id, phone
        FROM users
        WHERE phone LIKE '%:%'
        ORDER BY id
    `);

    for (const row of result.rows) {
        const decrypted = decrypt(row.phone);

        console.log(
            `Utilisateur ID ${row.id} =>`,
            decrypted === null
                ? 'ÉCHEC DU DÉCHIFFREMENT'
                : 'DÉCHIFFREMENT RÉUSSI'
        );
    }
} catch (error) {
    console.error('Erreur :', error.message);
} finally {
    await pool.end();
}
