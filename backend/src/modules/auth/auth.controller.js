import {
    loginUser,
    getUserById,
    registerPatient,
    getPractitionerOptions,
    registerPractitioner,
    RegistrationError,
} from './auth.service.js';
import {
    validateRegistration,
    validatePractitionerRequest,
    PASSWORD_RULES_MESSAGE,
} from '../../shared/utils/validators.js';

export async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const data = await loginUser(email, password);
        res.json(data);
    } catch (err) {
        // Renvoie une erreur 401 (Non autorisé)
        res.status(401).json({ error: err.message });
    }
}

export async function getMe(req, res) {
    try {
        // req.user est injecté par le middleware authenticate
        const user = await getUserById(req.user.id);
        res.json(user);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
}

export async function register(req, res) {
    const { valid, errors, values } = validateRegistration(req.body);

    if (!valid) {
        return res.status(400).json({ error: 'Données invalides', fields: errors });
    }

    try {
        await registerPatient(values, req.ip);

        return res.status(201).json({
            message:
                'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse email avant de vous connecter.',
        });
    } catch (err) {
        if (err instanceof RegistrationError) {
            if (err.code === 'CONFLICT') {
                // Message volontairement neutre : il ne confirme pas qu'un compte existe.
                return res.status(409).json({
                    error:
                        "Impossible de créer le compte avec ces informations. Si vous avez déjà un compte, connectez-vous ou réinitialisez votre mot de passe.",
                });
            }

            if (err.code === 'REJECTED') {
                return res.status(400).json({
                    error: 'Données invalides',
                    fields: { password: PASSWORD_RULES_MESSAGE },
                });
            }
        }

        console.error('========== ERREUR INSCRIPTION ==========');
console.error(err);
console.error('Message :', err.message);
console.error('Code :', err.code);
console.error('Status :', err.status);
console.error('Stack :', err.stack);
console.error('========================================');
        return res.status(500).json({
            error: 'Inscription impossible pour le moment. Veuillez réessayer.',
        });
    }
}

// Listes du formulaire de demande praticien (spécialités et cliniques).
export async function practitionerOptions(req, res) {
    try {
        return res.json(await getPractitionerOptions());
    } catch (err) {
        console.error('Options praticien :', err.message);
        return res.status(500).json({ error: 'Impossible de charger les listes pour le moment.' });
    }
}

// Inscription praticien : compte créé directement (Keycloak + profil MedLink), sans validation admin.
export async function signupPractitioner(req, res) {
    const { valid, errors, values } = validatePractitionerRequest(req.body);

    if (!valid) {
        return res.status(400).json({ error: 'Données invalides', fields: errors });
    }

    try {
        await registerPractitioner(values, req.ip);

        return res.status(201).json({
            message:
                'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse email avant de vous connecter.',
        });
    } catch (err) {
        if (err instanceof RegistrationError) {
            if (err.code === 'CONFLICT') {
                // Message volontairement neutre : il ne confirme pas qu'un compte existe.
                return res.status(409).json({
                    error:
                        "Impossible de créer le compte avec ces informations. Si vous avez déjà un compte, connectez-vous ou réinitialisez votre mot de passe.",
                });
            }
            if (err.code === 'REJECTED') {
                return res.status(400).json({
                    error: 'Données invalides',
                    fields: { password: PASSWORD_RULES_MESSAGE },
                });
            }
            if (err.code === 'BAD_CLINIQUE') {
                return res.status(400).json({
                    error: 'Données invalides',
                    fields: { cliniqueId: 'Veuillez choisir une clinique' },
                });
            }
        }

        console.error('Erreur inscription praticien :', err.message);
        return res.status(500).json({
            error: 'Inscription impossible pour le moment. Veuillez réessayer.',
        });
    }
}
