import pool from '../../shared/utils/db.js';
import * as kc from './keycloak.admin.js';
import { HttpError } from './http-error.js';

export const ROLES = kc.APP_ROLES; // ['patient', 'practitioner', 'admin'] (ordre = priorité croissante)
const PASSWORD_MIN = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_COLUMNS = 'id, email, full_name, role, specialty, phone, keycloak_id, created_at';

const bad = (msg) => new HttpError(400, msg);
const orNull = (v) => {
    const s = typeof v === 'string' ? v.trim() : v;
    return s === undefined || s === '' ? null : s;
};
const splitName = (full) => {
    const parts = full.trim().split(/\s+/);
    const firstName = parts.shift();
    return { firstName, lastName: parts.join(' ') || firstName };
};
const checkPassword = (pw) => {
    if (typeof pw !== 'string' || pw.length < PASSWORD_MIN)
        throw bad(`Le mot de passe temporaire doit contenir au moins ${PASSWORD_MIN} caractères`);
};

// Traçabilité des actions admin (journal_audit, service de M4). Appelée APRÈS succès de l'action.
export async function recordAudit(req, action, ressource) {
    try {
        await pool.query(
            `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip) VALUES ($1, $2, $3, $4)`,
            [req.user.id, action, ressource, req.ip]
        );
    } catch (err) {
        console.error('Erreur journalisation:', err);
    }
}

// ---------------------------------------------------------------- Supervision (US-15)
export async function getStats() {
    const [users, appts, today, cliniques, audit] = await Promise.all([
        pool.query(`SELECT role, COUNT(*)::int AS n FROM users GROUP BY role`),
        pool.query(`SELECT status, COUNT(*)::int AS n FROM appointments GROUP BY status`),
        pool.query(`SELECT COUNT(*)::int AS n FROM appointments WHERE appointment_date = CURRENT_DATE`),
        pool.query(`
      SELECT c.id, c.nom, c.ville,
        (SELECT COUNT(*)::int FROM practitioner_clinique pc WHERE pc.clinique_id = c.id) AS praticiens,
        COUNT(a.id)::int AS rdv_total,
        COUNT(a.id) FILTER (WHERE a.appointment_date >= CURRENT_DATE AND a.status IN ('pending','confirmed'))::int AS rdv_a_venir,
        COUNT(DISTINCT a.patient_id)::int AS patients
      FROM cliniques c LEFT JOIN appointments a ON a.clinique_id = c.id
      GROUP BY c.id ORDER BY c.nom`),
        // LEFT JOIN : utilisateur_id est ON DELETE SET NULL
        pool.query(`
      SELECT j.id, j.action, j.ressource, j.date_heure, u.full_name
      FROM journal_audit j LEFT JOIN users u ON u.id = j.utilisateur_id
      ORDER BY j.date_heure DESC, j.id DESC LIMIT 10`),
    ]);

    const byRole = Object.fromEntries(ROLES.map((r) => [r, 0]));
    users.rows.forEach((r) => { byRole[r.role] = r.n; });
    const byStatus = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    appts.rows.forEach((r) => { byStatus[r.status] = r.n; });

    return {
        users: { ...byRole, total: Object.values(byRole).reduce((a, b) => a + b, 0) },
        appointments: { ...byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0), today: today.rows[0].n },
        cliniques: cliniques.rows,
        audit: audit.rows,
    };
}

// ---------------------------------------------------------------- Comptes (US-12, US-13)
export async function listUsers({ role, q }) {
    const params = [];
    const where = [];
    if (role) { params.push(role); where.push(`role = $${params.length}`); }
    if (q) {
        params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
        where.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }
    const { rows } = await pool.query(
        `SELECT ${USER_COLUMNS} FROM users ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC, id DESC`,
        params
    );

    // L'état activé/désactivé n'existe que dans Keycloak : si Keycloak est indisponible, la liste reste utilisable
    let enabledById = null;
    try {
        enabledById = new Map((await kc.listAllUsers()).map((u) => [u.id, u.enabled]));
    } catch (err) {
        console.error('[admin] Keycloak indisponible pour la liste :', err.message);
    }
    return {
        keycloak_ok: !!enabledById,
        users: rows.map((u) => ({
            ...u,
            linked: !!u.keycloak_id,
            enabled: enabledById && u.keycloak_id ? (enabledById.get(u.keycloak_id) ?? null) : null,
        })),
    };
}

export async function createUser(input) {
    const email = String(input.email || '').trim().toLowerCase();
    const full_name = String(input.full_name || '').trim();
    const { role, password } = input;
    if (!EMAIL_RE.test(email)) throw bad('Adresse e-mail invalide');
    if (!full_name) throw bad('Le nom complet est obligatoire');
    if (!ROLES.includes(role)) throw bad('Rôle invalide');
    checkPassword(password);
    const specialty = role === 'practitioner' ? orNull(input.specialty) : null;

    if ((await pool.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount)
        throw new HttpError(409, 'Cette adresse e-mail est déjà utilisée');

    const { firstName, lastName } = splitName(full_name);
    // Mot de passe temporaire à changer à la 1re connexion ; TOTP obligatoire pour praticiens et admins
    const requiredActions = role === 'patient' ? ['UPDATE_PASSWORD'] : ['UPDATE_PASSWORD', 'CONFIGURE_TOTP'];

    const kcId = await kc.createUser({ email, firstName, lastName, password, requiredActions });
    try {
        await kc.setUserRole(kcId, role);
        const { rows } = await pool.query(
            `INSERT INTO users (email, full_name, role, specialty, phone, keycloak_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${USER_COLUMNS}`,
            [email, full_name, role, specialty, orNull(input.phone), kcId]
        );
        return { ...rows[0], linked: true, enabled: true };
    } catch (err) {
        // Compensation : pas de compte Keycloak orphelin si le profil local n'a pas pu être créé
        await kc.deleteUser(kcId).catch((e) => console.error('Rollback Keycloak échoué', kcId, e.message));
        throw err;
    }
}

async function getLocalUser(id) {
    const user = (await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id])).rows[0];
    if (!user) throw new HttpError(404, 'Utilisateur introuvable');
    return user;
}
const needLinked = (user) => {
    if (!user.keycloak_id)
        throw new HttpError(409, "Ce compte n'est pas rattaché à Keycloak : lancez d'abord la synchronisation");
};

export async function updateUser(id, actorId, input) {
    const user = await getLocalUser(id);
    const sets = [];
    const values = [];
    const push = (col, val) => { values.push(val); sets.push(`${col} = $${values.length}`); };

    let newRole = user.role;
    if (input.role !== undefined && input.role !== user.role) {
        if (!ROLES.includes(input.role)) throw bad('Rôle invalide');
        if (user.id === actorId) throw bad('Vous ne pouvez pas modifier votre propre rôle');
        needLinked(user);
        // Un compte déjà utilisé dans des données médicales ne change plus de rôle (intégrité des dossiers)
        const linked = await pool.query(
            `SELECT 1 FROM appointments WHERE patient_id = $1 OR practitioner_id = $1
       UNION ALL SELECT 1 FROM medical_records WHERE patient_id = $1 OR practitioner_id = $1
       UNION ALL SELECT 1 FROM lab_results WHERE patient_id = $1 LIMIT 1`,
            [id]
        );
        if (linked.rowCount)
            throw new HttpError(409, 'Ce compte a des rendez-vous ou dossiers associés : son rôle ne peut plus être modifié');
        await kc.setUserRole(user.keycloak_id, input.role);
        newRole = input.role;
        push('role', newRole);
        if (user.role === 'practitioner') await pool.query('DELETE FROM practitioner_clinique WHERE practitioner_id = $1', [id]);
    }

    if (input.full_name !== undefined) {
        const name = String(input.full_name).trim();
        if (!name) throw bad('Le nom complet est obligatoire');
        if (name !== user.full_name) {
            needLinked(user);
            await kc.updateName(user.keycloak_id, splitName(name));
            push('full_name', name);
        }
    }
    if (input.phone !== undefined) push('phone', orNull(input.phone));
    if (newRole !== user.role || input.specialty !== undefined) {
        push('specialty', newRole === 'practitioner' ? orNull(input.specialty ?? user.specialty) : null);
    }
    if (!sets.length) throw bad('Aucune modification fournie');

    values.push(id);
    const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${USER_COLUMNS}`,
        values
    );
    return rows[0];
}

export async function setUserStatus(id, actorId, enabled) {
    if (typeof enabled !== 'boolean') throw bad('Le champ "enabled" (booléen) est obligatoire');
    const user = await getLocalUser(id);
    if (user.id === actorId) throw bad('Vous ne pouvez pas désactiver votre propre compte');
    needLinked(user);
    await kc.setEnabled(user.keycloak_id, enabled);
    return user;
}

export async function resetUserPassword(id, password) {
    checkPassword(password);
    const user = await getLocalUser(id);
    needLinked(user);
    await kc.resetPassword(user.keycloak_id, password);
    return user;
}

// Double validation (cahier des charges M5) : l'e-mail du compte doit être retapé, vérifié aussi côté serveur
export async function deleteUser(id, actorId, confirmEmail) {
    const user = await getLocalUser(id);
    if (user.id === actorId) throw bad('Vous ne pouvez pas supprimer votre propre compte');
    if (String(confirmEmail || '').trim().toLowerCase() !== user.email)
        throw bad("Confirmation invalide : l'adresse e-mail saisie ne correspond pas au compte");

    const linked = await pool.query(
        `SELECT 1 FROM appointments WHERE patient_id = $1 OR practitioner_id = $1
     UNION ALL SELECT 1 FROM medical_records WHERE patient_id = $1 OR practitioner_id = $1
     UNION ALL SELECT 1 FROM lab_results WHERE patient_id = $1 LIMIT 1`,
        [id]
    );
    if (linked.rowCount)
        throw new HttpError(409, 'Ce compte a des rendez-vous ou dossiers associés : désactivez-le plutôt que de le supprimer');

    if (user.keycloak_id) {
        try { await kc.deleteUser(user.keycloak_id); }
        catch (err) { if (err.status !== 404) throw err; } // déjà supprimé côté Keycloak : on nettoie le profil local
    }
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return user;
}

/**
 * Réconciliation Keycloak -> base locale : rattache les profils existants (par e-mail vérifié),
 * crée les profils manquants et resynchronise les rôles. Keycloak fait foi.
 */
export async function syncFromKeycloak() {
    const [all, members] = await Promise.all([kc.listAllUsers(), Promise.all(ROLES.map((r) => kc.listRoleMembers(r)))]);
    const roleOf = new Map();
    ROLES.forEach((r, i) => members[i].forEach((u) => roleOf.set(u.id, r))); // le rôle le plus élevé gagne
    const res = { total: 0, linked: 0, created: 0, updated: 0, skipped: 0 };

    for (const u of all) {
        if (!u.email || u.username?.startsWith('service-account-')) continue;
        res.total++;
        const email = u.email.toLowerCase();
        const role = roleOf.get(u.id) || 'patient';
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || email;

        const known = await pool.query('SELECT id, role FROM users WHERE keycloak_id = $1', [u.id]);
        if (known.rowCount) {
            if (known.rows[0].role !== role) {
                await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, known.rows[0].id]);
                res.updated++;
            }
            continue;
        }
        if (u.emailVerified) {
            const link = await pool.query(
                'UPDATE users SET keycloak_id = $1, role = $3 WHERE email = $2 AND keycloak_id IS NULL RETURNING id',
                [u.id, email, role]
            );
            if (link.rowCount) { res.linked++; continue; }
        }
        const ins = await pool.query(
            'INSERT INTO users (email, full_name, role, keycloak_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [email, name, role, u.id]
        );
        ins.rowCount ? res.created++ : res.skipped++;
    }
    return res;
}

// ---------------------------------------------------------------- Cliniques (US-29)
export async function listCliniques() {
    const { rows } = await pool.query(`
    SELECT c.id, c.nom, c.ville, c.adresse, c.telephone,
      COALESCE(json_agg(json_build_object('id', u.id, 'full_name', u.full_name, 'specialty', u.specialty)
               ORDER BY u.full_name) FILTER (WHERE u.id IS NOT NULL), '[]') AS practitioners
    FROM cliniques c
    LEFT JOIN practitioner_clinique pc ON pc.clinique_id = c.id
    LEFT JOIN users u ON u.id = pc.practitioner_id
    GROUP BY c.id ORDER BY c.nom`);
    return rows;
}

function cliniqueFields(input) {
    const nom = String(input.nom || '').trim();
    const ville = String(input.ville || '').trim();
    if (!nom || !ville) throw bad('Le nom et la ville sont obligatoires');
    return [nom, ville, orNull(input.adresse), orNull(input.telephone)];
}

export async function createClinique(input) {
    const { rows } = await pool.query(
        'INSERT INTO cliniques (nom, ville, adresse, telephone) VALUES ($1, $2, $3, $4) RETURNING *',
        cliniqueFields(input)
    );
    return rows[0];
}

export async function updateClinique(id, input) {
    const { rows } = await pool.query(
        'UPDATE cliniques SET nom = $1, ville = $2, adresse = $3, telephone = $4 WHERE id = $5 RETURNING *',
        [...cliniqueFields(input), id]
    );
    if (!rows[0]) throw new HttpError(404, 'Clinique introuvable');
    return rows[0];
}

export async function deleteClinique(id) {
    try {
        const { rows } = await pool.query('DELETE FROM cliniques WHERE id = $1 RETURNING *', [id]);
        if (!rows[0]) throw new HttpError(404, 'Clinique introuvable');
        return rows[0];
    } catch (err) {
        if (err.code === '23503') throw new HttpError(409, 'Cette clinique a des rendez-vous : elle ne peut pas être supprimée');
        throw err;
    }
}

export async function setCliniquePractitioners(id, ids) {
    if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n) && n > 0)) throw bad('Liste de praticiens invalide');
    const unique = [...new Set(ids)];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const clinique = (await client.query('SELECT id, nom FROM cliniques WHERE id = $1', [id])).rows[0];
        if (!clinique) throw new HttpError(404, 'Clinique introuvable');
        const valid = await client.query(`SELECT id FROM users WHERE id = ANY($1::int[]) AND role = 'practitioner'`, [unique]);
        if (valid.rowCount !== unique.length) throw bad('Un ou plusieurs comptes ne sont pas des praticiens');
        await client.query('DELETE FROM practitioner_clinique WHERE clinique_id = $1', [id]);
        if (unique.length)
            await client.query(
                'INSERT INTO practitioner_clinique (practitioner_id, clinique_id) SELECT unnest($1::int[]), $2',
                [unique, id]
            );
        await client.query('COMMIT');
        return clinique;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// ---------------------------------------------------------------- Journal d'audit (lecture)
export async function listAudit({ action, limit, offset }) {
    const where = action ? 'WHERE j.action = $1' : '';
    const params = action ? [action] : [];
    const [items, total, actions] = await Promise.all([
        pool.query(
            `SELECT j.id, j.action, j.ressource, j.date_heure, j.adresse_ip, u.full_name, u.email
       FROM journal_audit j LEFT JOIN users u ON u.id = j.utilisateur_id ${where}
       ORDER BY j.date_heure DESC, j.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        ),
        pool.query(`SELECT COUNT(*)::int AS n FROM journal_audit j ${where}`, params),
        pool.query('SELECT DISTINCT action FROM journal_audit ORDER BY action'),
    ]);
    return { items: items.rows, total: total.rows[0].n, actions: actions.rows.map((r) => r.action) };
}