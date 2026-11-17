import pool from '../../shared/utils/db.js';
import { HttpError } from './http-error.js';
import { isRealDate } from './admin.rdv.service.js';

const bad = (msg) => new HttpError(400, msg);
const TZ = 'Africa/Tunis';
const MAX_DAYS = 1830; // 5 ans
const DAY = 86400000;

// Seuil d'anonymisation (US-46) : toute cellule de moins de K rendez-vous ou patients est masquée
export const MIN_CELL = 5;

const STATUS_FR = { pending: 'en_attente', confirmed: 'confirme', completed: 'termine', cancelled: 'annule' };

// ---------------------------------------------------------------- Période
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

async function todayTunis() {
    const { rows } = await pool.query(`SELECT (NOW() AT TIME ZONE '${TZ}')::date::text AS d`);
    return rows[0].d;
}

// from/to au format AAAA-MM-JJ ; par défaut les `defaultDays` derniers jours (aujourd'hui inclus)
export async function parsePeriod({ from, to }, defaultDays) {
    const today = await todayTunis();
    const end = to || today;
    const start = from || addDays(end, -(defaultDays - 1));
    if (!isRealDate(start) || !isRealDate(end)) throw bad('Période invalide (format AAAA-MM-JJ attendu)');
    if (start > end) throw bad('La date de début doit précéder la date de fin');
    if (diffDays(start, end) > MAX_DAYS) throw bad('Période trop longue (5 ans maximum)');
    return { from: start, to: end };
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

// ---------------------------------------------------------------- US-50 : synthèse pour la Direction
export async function getSynthese(period) {
    const { from, to } = period;
    const span = diffDays(from, to) + 1;
    const prevTo = addDays(from, -1);
    const prevFrom = addDays(prevTo, -(span - 1));
    const between = 'a.appointment_date BETWEEN $1::date AND $2::date';

    const [statuts, actifs, comptes, cliniques, specialites, mois, precedent] = await Promise.all([
        pool.query(`SELECT a.status, COUNT(*)::int AS n FROM appointments a WHERE ${between} GROUP BY a.status`, [from, to]),
        pool.query(`SELECT COUNT(DISTINCT a.patient_id)::int AS n FROM appointments a WHERE ${between}`, [from, to]),
        pool.query(
            `SELECT role, COUNT(*)::int AS n FROM users
       WHERE (created_at AT TIME ZONE '${TZ}')::date BETWEEN $1::date AND $2::date GROUP BY role`,
            [from, to]
        ),
        pool.query(
            `SELECT COALESCE(c.nom, 'Non renseignée') AS clinique,
              COUNT(*)::int AS rdv,
              COUNT(*) FILTER (WHERE a.status = 'completed')::int AS realises,
              COUNT(*) FILTER (WHERE a.status = 'cancelled')::int AS annules,
              COUNT(DISTINCT a.patient_id)::int AS patients
       FROM appointments a LEFT JOIN cliniques c ON c.id = a.clinique_id
       WHERE ${between} GROUP BY c.id, c.nom ORDER BY rdv DESC, clinique`,
            [from, to]
        ),
        pool.query(
            `SELECT COALESCE(NULLIF(u.specialty, ''), 'Non renseignée') AS specialite, COUNT(*)::int AS rdv
       FROM appointments a JOIN users u ON u.id = a.practitioner_id
       WHERE ${between} GROUP BY 1 ORDER BY rdv DESC, specialite`,
            [from, to]
        ),
        pool.query(
            `SELECT to_char(date_trunc('month', a.appointment_date), 'YYYY-MM') AS mois, COUNT(*)::int AS rdv
       FROM appointments a WHERE ${between} GROUP BY 1 ORDER BY 1`,
            [from, to]
        ),
        pool.query(`SELECT COUNT(*)::int AS n FROM appointments a WHERE ${between}`, [prevFrom, prevTo]),
    ]);

    const byStatus = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    statuts.rows.forEach((r) => { byStatus[r.status] = r.n; });
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const newAccounts = { patient: 0, practitioner: 0, admin: 0 };
    comptes.rows.forEach((r) => { newAccounts[r.role] = r.n; });
    const prevTotal = precedent.rows[0].n;

    return {
        period: { from, to, days: span },
        previous: { from: prevFrom, to: prevTo, rdv_total: prevTotal },
        kpis: {
            rdv_total: total,
            variation_pct: prevTotal > 0 ? pct(total - prevTotal, prevTotal) : null,
            par_statut: byStatus,
            taux_annulation_pct: pct(byStatus.cancelled, total),
            taux_realisation_pct: pct(byStatus.completed, total),
            patients_actifs: actifs.rows[0].n,
            nouveaux_comptes: newAccounts,
        },
        par_clinique: cliniques.rows,
        par_specialite: specialites.rows,
        par_mois: mois.rows,
    };
}

// ---------------------------------------------------------------- US-32 / US-46 : export anonymisé
/**
 * Données agrégées sans aucun identifiant : pas de nom, d'e-mail, d'identifiant ni de motif de consultation.
 * La date est tronquée au mois, et toute cellule inférieure à MIN_CELL est masquée (null) ;
 * aucun total n'est publié, pour qu'un chiffre masqué ne puisse pas se déduire par soustraction.
 */
export async function getAnonymizedStats(period) {
    const { from, to } = period;
    const { rows } = await pool.query(
        `SELECT to_char(date_trunc('month', a.appointment_date), 'YYYY-MM') AS periode,
            COALESCE(c.nom, 'Non renseignée') AS clinique,
            COALESCE(NULLIF(u.specialty, ''), 'Non renseignée') AS specialite,
            a.status AS statut,
            COUNT(*)::int AS nb_rdv,
            COUNT(DISTINCT a.patient_id)::int AS nb_patients
     FROM appointments a
     JOIN users u ON u.id = a.practitioner_id
     LEFT JOIN cliniques c ON c.id = a.clinique_id
     WHERE a.appointment_date BETWEEN $1::date AND $2::date
     GROUP BY 1, c.id, c.nom, 2, 3, 4
     ORDER BY 1, 2, 3, 4`,
        [from, to]
    );

    let masked = 0;
    const data = rows.map((r) => {
        const hide = r.nb_rdv < MIN_CELL;
        if (hide) masked++;
        return {
            periode: r.periode,
            clinique: r.clinique,
            specialite: r.specialite,
            statut: STATUS_FR[r.statut] || r.statut,
            nb_rdv: hide ? null : r.nb_rdv,
            nb_patients: hide || r.nb_patients < MIN_CELL ? null : r.nb_patients,
        };
    });

    return {
        period: { from, to },
        min_cell: MIN_CELL,
        rows: data,
        masked_rows: masked,
        rules: [
            'Aucune donnée nominative : ni nom, ni e-mail, ni identifiant, ni motif de consultation',
            'Dates regroupées par mois',
            `Tout effectif inférieur à ${MIN_CELL} est masqué (<${MIN_CELL})`,
            'Aucun total publié : un chiffre masqué ne peut pas être retrouvé par soustraction',
        ],
    };
}

// Échappement CSV + neutralisation des formules (=, +, -, @) interprétées par Excel
function csvCell(v) {
    if (v === null || v === undefined) return `<${MIN_CELL}`;
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Séparateur ";" et BOM UTF-8 : s'ouvre correctement dans Excel en français
export function toCsv(stats) {
    const head = ['periode', 'clinique', 'specialite', 'statut', 'nombre_rdv', 'nombre_patients'];
    const lines = [head.join(';')];
    stats.rows.forEach((r) => {
        lines.push([r.periode, r.clinique, r.specialite, r.statut, r.nb_rdv, r.nb_patients].map(csvCell).join(';'));
    });
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}

// ---------------------------------------------------------------- US-51 : suivi de la baisse des appels
let schemaReady = null;
function ensureSchema() {
    // Tables créées à la demande : fonctionne sur une base existante, sans relancer le seed.
    // Pas de clé étrangère vers users : le TRUNCATE ... CASCADE du seed ne doit pas vider ces mesures.
    schemaReady ??= pool
        .query(`
      CREATE TABLE IF NOT EXISTS suivi_appels (
        semaine DATE PRIMARY KEY,
        nb_appels INTEGER NOT NULL CHECK (nb_appels >= 0),
        note TEXT,
        saisi_par INTEGER,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS parametres_portail (
        cle VARCHAR(60) PRIMARY KEY,
        valeur TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );`)
        .catch((err) => {
            schemaReady = null;
            throw err;
        });
    return schemaReady;
}

const K_REF = 'appels_reference_hebdo';
const K_OBJ = 'appels_objectif_baisse_pct';

export async function getSuivi(weeksParam) {
    await ensureSchema();
    const weeks = Math.min(Math.max(parseInt(weeksParam, 10) || 12, 4), 52);

    const [params, semaines] = await Promise.all([
        pool.query('SELECT cle, valeur FROM parametres_portail WHERE cle = ANY($1)', [[K_REF, K_OBJ]]),
        pool.query(
            `WITH debut AS (
         SELECT date_trunc('week', (NOW() AT TIME ZONE '${TZ}')::date)::date AS lundi
       ), bornes AS (
         SELECT (d.lundi - g * 7) AS semaine FROM debut d, generate_series(0, $1::int - 1) g
       )
       SELECT to_char(b.semaine, 'YYYY-MM-DD') AS semaine, s.nb_appels, s.note,
              (SELECT COUNT(*)::int FROM appointments a
               WHERE (a.created_at AT TIME ZONE '${TZ}')::date >= b.semaine
                 AND (a.created_at AT TIME ZONE '${TZ}')::date < b.semaine + 7) AS rdv_en_ligne
       FROM bornes b LEFT JOIN suivi_appels s ON s.semaine = b.semaine
       ORDER BY b.semaine`,
            [weeks]
        ),
    ]);

    const map = Object.fromEntries(params.rows.map((r) => [r.cle, Number(r.valeur)]));
    const reference = map[K_REF] ?? null;
    const objectif = map[K_OBJ] ?? null;

    const items = semaines.rows.map((s) => ({
        ...s,
        baisse_pct: reference > 0 && s.nb_appels !== null ? Math.round(((reference - s.nb_appels) / reference) * 1000) / 10 : null,
    }));

    // Moyenne des 4 dernières semaines renseignées
    const saisies = items.filter((s) => s.nb_appels !== null).slice(-4);
    const moyenne = saisies.length ? Math.round((saisies.reduce((a, s) => a + s.nb_appels, 0) / saisies.length) * 10) / 10 : null;

    return {
        reference,
        objectif_baisse_pct: objectif,
        semaines: items,
        resume: {
            semaines_renseignees: saisies.length,
            moyenne_recente: moyenne,
            baisse_pct: reference > 0 && moyenne !== null ? Math.round(((reference - moyenne) / reference) * 1000) / 10 : null,
        },
    };
}

export async function saveSemaine({ semaine, nb_appels, note }, actorId) {
    await ensureSchema();
    if (!isRealDate(semaine)) throw bad('Date invalide');
    const n = Number(nb_appels);
    if (!Number.isInteger(n) || n < 0 || n > 100000) throw bad("Le nombre d'appels doit être un entier positif");
    const text = typeof note === 'string' && note.trim() ? note.trim().slice(0, 300) : null;

    const ok = await pool.query(
        `SELECT date_trunc('week', $1::date)::date <= date_trunc('week', (NOW() AT TIME ZONE '${TZ}')::date)::date AS ok`,
        [semaine]
    );
    if (!ok.rows[0].ok) throw bad('Impossible de saisir une semaine future');

    const { rows } = await pool.query(
        `INSERT INTO suivi_appels (semaine, nb_appels, note, saisi_par)
     VALUES (date_trunc('week', $1::date)::date, $2, $3, $4)
     ON CONFLICT (semaine) DO UPDATE
       SET nb_appels = EXCLUDED.nb_appels, note = EXCLUDED.note, saisi_par = EXCLUDED.saisi_par, updated_at = NOW()
     RETURNING to_char(semaine, 'YYYY-MM-DD') AS semaine, nb_appels, note`,
        [semaine, n, text, actorId]
    );
    return rows[0];
}

export async function saveReference({ nb_appels_hebdo, objectif_baisse_pct }) {
    await ensureSchema();
    const ref = Number(nb_appels_hebdo);
    if (!Number.isInteger(ref) || ref <= 0 || ref > 100000) throw bad("L'appel hebdomadaire de référence doit être un entier strictement positif");

    const hasObj = objectif_baisse_pct !== undefined && objectif_baisse_pct !== null && objectif_baisse_pct !== '';
    const obj = hasObj ? Number(objectif_baisse_pct) : null;
    if (hasObj && (!Number.isFinite(obj) || obj <= 0 || obj > 100)) throw bad("L'objectif de baisse doit être compris entre 0 et 100 %");

    const upsert = `INSERT INTO parametres_portail (cle, valeur) VALUES ($1, $2)
                  ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated_at = NOW()`;
    await pool.query(upsert, [K_REF, String(ref)]);
    if (hasObj) await pool.query(upsert, [K_OBJ, String(obj)]);
    else await pool.query('DELETE FROM parametres_portail WHERE cle = $1', [K_OBJ]);
    return { reference: ref, objectif_baisse_pct: obj };
}