export const ROLE_LABEL = { patient: 'Patient', practitioner: 'Praticien', admin: 'Administrateur' };
export const ROLE_BADGE = { patient: 'badge-info', practitioner: 'badge-success', admin: 'badge-warning' };

export const fmtDateTime = (iso) =>
    new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

const ACTION_LABELS = {
    LOGIN: 'Connexion',
    VIEW_RECORD: 'Consultation de dossier',
    ADMIN_CREATE_USER: 'Création de compte',
    ADMIN_UPDATE_USER: 'Modification de compte',
    ADMIN_UPDATE_USER_ROLE: 'Changement de rôle',
    ADMIN_ENABLE_USER: 'Activation de compte',
    ADMIN_DISABLE_USER: 'Désactivation de compte',
    ADMIN_RESET_PASSWORD: 'Réinitialisation de mot de passe',
    ADMIN_DELETE_USER: 'Suppression de compte',
    ADMIN_SYNC_KEYCLOAK: 'Synchronisation Keycloak',
    ADMIN_CREATE_CLINIQUE: 'Création de clinique',
    ADMIN_UPDATE_CLINIQUE: 'Modification de clinique',
    ADMIN_DELETE_CLINIQUE: 'Suppression de clinique',
    ADMIN_ASSIGN_PRACTITIONERS: 'Affectation de praticiens',
    ADMIN_CREATE_APPOINTMENT: 'Rendez-vous créé pour un patient',
    ADMIN_CANCEL_APPOINTMENT: 'Annulation de rendez-vous',
    ADMIN_EXPORT_STATS: 'Export de statistiques anonymisées',
    ADMIN_SAVE_APPELS: "Saisie des appels de la semaine",
    ADMIN_SAVE_APPELS_REFERENCE: "Référence des appels modifiée",
};
export const actionLabel = (action) => ACTION_LABELS[action] || action;

// Mot de passe temporaire aléatoire (16 car., sans caractères ambigus) généré dans le navigateur
export function generatePassword() {
    const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '#@$%&*!?'];
    const all = sets.join('');
    const rnd = (n) => {
        const a = new Uint32Array(1);
        crypto.getRandomValues(a);
        return a[0] % n;
    };
    const chars = sets.map((s) => s[rnd(s.length)]);
    while (chars.length < 16) chars.push(all[rnd(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
        const j = rnd(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}