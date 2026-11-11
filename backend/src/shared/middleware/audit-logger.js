import pool from '../utils/db.js';

export function logAction(action, ressource = null) {
    return async (req, res, next) => {
        try {
            //auparavant audit par id user
            // Récupérer la vraie IP derrière un proxy (Nginx/Keycloak)
            const clientIp = req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(',')[0].trim()
                : req.ip;

            await pool.query(
                `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip) VALUES ($1, $2, $3, $4)`,
                [req.user?.id || null, action, ressource, clientIp]
            );
        } catch (err) {
            // On loggue l'erreur côté serveur mais on ne bloque pas la requête de l'utilisateur
            console.error('Erreur journalisation audit:', err.message);
        }
        next();
    };
}