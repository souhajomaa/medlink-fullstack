import pool from '../utils/db.js';

/**
 * Middleware de journalisation des actions (US-47, US-35)
 * @param {string} action - Le type d'action (ex: 'LOGIN', 'VIEW_RECORD')
 * @param {string|Function} ressource - La ressource concernée. Peut être une chaîne ou une fonction qui reçoit (req) pour une évaluation dynamique.
 */
export function logAction(action, ressource = null) {
    return async (req, res, next) => {
        try {
            // 1. Récupération robuste de l'IP (compatible Nginx/Docker/Cloud)
            const clientIp = req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(',')[0].trim()
                : (req.ip || req.connection?.remoteAddress || 'IP_INCONNUE');

            // 2. Évaluation dynamique de la ressource (TA SUPER IDÉE)
            const ressourceValue = typeof ressource === 'function'
                ? ressource(req)
                : ressource;

            // 3. Insertion en base de données
            await pool.query(
                `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip)
                 VALUES ($1, $2, $3, $4)`,
                [req.user?.id || null, action, ressourceValue, clientIp]
            );
        } catch (err) {
            // On loggue l'erreur côté serveur mais on ne bloque PAS la requête de l'utilisateur
            console.error('❌ Erreur journalisation audit:', err.message);
        }

        // On continue la chaîne de middleware quoi qu'il arrive
        next();
    };
}