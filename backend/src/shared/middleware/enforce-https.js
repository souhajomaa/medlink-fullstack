/**
 * Middleware de vérification HTTPS (US-44)
 * Bloque les requêtes non sécurisées, sauf en développement local.
 */
export function enforceHTTPS(req, res, next) {
    // 1. Vérifie si la requête est réellement sécurisée (HTTPS)
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

    // 2. Autorise HTTP uniquement pour le développement local (localhost ou nom de service docker)
    const isLocalDev = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname === 'backend';

    // 3. Si ce n'est pas sécurisé ET que ce n'est pas du dev local, on bloque
    if (!isSecure && !isLocalDev) {
        return res.status(403).json({
            error: 'HTTPS requis. Connexion non sécurisée refusée (US-44).'
        });
    }

    next();
}