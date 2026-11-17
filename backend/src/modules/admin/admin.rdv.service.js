import pool from '../../shared/utils/db.js';
import { HttpError } from './http-error.js';

// US-30 : le personnel administratif prend ou annule un rendez-vous au nom d'un patient
// (par exemple après un appel téléphonique).

const bad = (msg) => new HttpError(400, msg);
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const TYPES = ['consultation', 'suivi', 'urgence', 'teleconsultation'];
const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const TZ = 'Africa/Tunis';

// "2026-02-31" respecte le format mais n'existe pas : on le refuse avant PostgreSQL (sinon erreur 500)
export function isRealDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const toId = (v, msg) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw bad(msg);
    return n;
};

const escapeLike = (q) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

// Recherche de patients pour la liste déroulante (20 résultats maximum)
export async function listPatients(q) {
    const params = [];
    let where = "WHERE role = 'patient'";
    if (q) {
        params.push(escapeLike(q));
        where += ` AND (full_name ILIKE $1 OR email ILIKE $1)`;
    }
    const { rows } = await pool.query(
        `SELECT id, full_name, email, phone FROM users ${where} ORDER BY full_name LIMIT 20`,
        params
    );
    return rows;
}

// Praticiens avec leurs cliniques d'exercice : sert à construire le formulaire de réservation
export async function listBookingOptions() {
    const { rows } = await pool.query(`
    SELECT u.id, u.full_name, u.specialty,
      COALESCE(
        json_agg(json_build_object('id', c.id, 'nom', c.nom, 'ville', c.ville) ORDER BY c.nom)
          FILTER (WHERE c.id IS NOT NULL),
        '[]'
      ) AS cliniques
    FROM users u
    LEFT JOIN practitioner_clinique pc ON pc.practitioner_id = u.id
    LEFT JOIN cliniques c ON c.id = pc.clinique_id
    WHERE u.role = 'practitioner'
    GROUP BY u.id
    ORDER BY u.full_name`);
    return rows;
}

export async function listAppointments({ status, cliniqueId, from, to, limit, offset }) {
    const params = [];
    const where = [];
    if (status) {
        if (!STATUSES.includes(status)) throw bad('Statut invalide');
        params.push(status);
        where.push(`a.status = $${params.length}`);
    }
    if (cliniqueId) {
        params.push(toId(cliniqueId, 'Clinique invalide'));
        where.push(`a.clinique_id = $${params.length}`);
    }
    if (from) {
        if (!isRealDate(from)) throw bad('Date de début invalide');
        params.push(from);
        where.push(`a.appointment_date >= $${params.length}::date`);
    }
    if (to) {
        if (!isRealDate(to)) throw bad('Date de fin invalide');
        params.push(to);
        where.push(`a.appointment_date <= $${params.length}::date`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [items, total] = await Promise.all([
        pool.query(
            `SELECT a.id, to_char(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
              to_char(a.appointment_time, 'HH24:MI') AS appointment_time,
              a.status, a.type, a.reason,
              p.id AS patient_id, p.full_name AS patient_name,
              d.id AS practitioner_id, d.full_name AS practitioner_name, d.specialty,
              c.nom AS clinique_nom
       FROM appointments a
       JOIN users p ON p.id = a.patient_id
       JOIN users d ON d.id = a.practitioner_id
       LEFT JOIN cliniques c ON c.id = a.clinique_id
       ${clause}
       ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        ),
        pool.query(`SELECT COUNT(*)::int AS n FROM appointments a ${clause}`, params),
    ]);
    return { items: items.rows, total: total.rows[0].n };
}

export async function createAppointmentForPatient(input) {
    const patientId = toId(input.patient_id, 'Patient invalide');
    const practitionerId = toId(input.practitioner_id, 'Praticien invalide');
    const cliniqueId = toId(input.clinique_id, 'Clinique invalide');
    const date = input.appointment_date;
    const time = input.appointment_time;
    if (!isRealDate(date)) throw bad('Date invalide');
    if (typeof time !== 'string' || !TIME_RE.test(time)) throw bad('Heure invalide');
    const type = input.type || 'consultation';
    if (!TYPES.includes(type)) throw bad('Type de consultation invalide');
    const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim().slice(0, 500) : null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Même verrou que la réservation côté patient : deux réservations simultanées du même praticien sont sérialisées
        await client.query('SELECT pg_advisory_xact_lock($1::integer)', [practitionerId]);

        const patient = (await client.query(`SELECT id, full_name FROM users WHERE id = $1 AND role = 'patient'`, [patientId])).rows[0];
        if (!patient) throw new HttpError(404, 'Patient introuvable');

        const practitioner = (
            await client.query(`SELECT id, full_name FROM users WHERE id = $1 AND role = 'practitioner'`, [practitionerId])
        ).rows[0];
        if (!practitioner) throw new HttpError(404, 'Praticien introuvable');

        const clinique = (await client.query('SELECT id, nom FROM cliniques WHERE id = $1', [cliniqueId])).rows[0];
        if (!clinique) throw new HttpError(404, 'Clinique introuvable');

        const member = await client.query(
            'SELECT 1 FROM practitioner_clinique WHERE practitioner_id = $1 AND clinique_id = $2',
            [practitionerId, cliniqueId]
        );
        if (!member.rowCount) throw bad("Ce praticien n'exerce pas dans cette clinique");

        // Créneau dans le futur, à l'heure de Tunis
        const future = await client.query(
            `SELECT ($1::date + $2::time) > (NOW() AT TIME ZONE '${TZ}') AS ok`,
            [date, time]
        );
        if (!future.rows[0].ok) throw bad('Ce créneau est déjà passé');

        // Absences et créneaux bloqués saisis par le praticien (module Disponibilités)
        const blocked = await client.query(
            `SELECT 1 FROM disponibilites
       WHERE practitioner_id = $1 AND type IN ('bloque', 'absence')
         AND $2::date BETWEEN date_debut AND date_fin
         AND $3::time >= heure_debut AND $3::time < heure_fin
       LIMIT 1`,
            [practitionerId, date, time]
        );
        if (blocked.rowCount) throw new HttpError(409, 'Le praticien est indisponible sur ce créneau (absence ou blocage)');

        const taken = await client.query(
            `SELECT 1 FROM appointments
       WHERE practitioner_id = $1 AND appointment_date = $2::date AND appointment_time = $3::time
         AND status IN ('pending', 'confirmed') LIMIT 1`,
            [practitionerId, date, time]
        );
        if (taken.rowCount) throw new HttpError(409, 'Ce créneau est déjà réservé pour ce praticien');

        const overlap = await client.query(
            `SELECT 1 FROM appointments
       WHERE patient_id = $1 AND appointment_date = $2::date AND appointment_time = $3::time
         AND status IN ('pending', 'confirmed') LIMIT 1`,
            [patientId, date, time]
        );
        if (overlap.rowCount) throw new HttpError(409, 'Ce patient a déjà un rendez-vous à cette heure');

        // Pris par le personnel après vérification : directement confirmé
        const { rows } = await client.query(
            `INSERT INTO appointments (patient_id, practitioner_id, clinique_id, appointment_date, appointment_time, reason, type, status)
       VALUES ($1, $2, $3, $4::date, $5::time, $6, $7, 'confirmed')
       RETURNING id, status, type, reason`,
            [patientId, practitionerId, cliniqueId, date, time, reason, type]
        );
        await client.query('COMMIT');

        return {
            ...rows[0],
            appointment_date: date,
            appointment_time: time.slice(0, 5),
            patient_id: patientId,
            patient_name: patient.full_name,
            practitioner_id: practitionerId,
            practitioner_name: practitioner.full_name,
            clinique_nom: clinique.nom,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

export async function cancelAppointment(id) {
    const { rows } = await pool.query(
        `UPDATE appointments SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'confirmed') RETURNING id`,
        [id]
    );
    if (rows[0]) return rows[0];
    const exists = await pool.query('SELECT status FROM appointments WHERE id = $1', [id]);
    if (!exists.rowCount) throw new HttpError(404, 'Rendez-vous introuvable');
    throw new HttpError(409, 'Ce rendez-vous ne peut plus être annulé');
}