import * as rdv from './admin.rdv.service.js';
import * as stats from './admin.stats.service.js';
import { recordAudit } from './admin.service.js';
import { HttpError } from './http-error.js';

// Express 4 n'attrape pas les erreurs des handlers async : on les traduit ici
const wrap = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const page = (req) => ({
    limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100),
    offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
});

// ---------------------------------------------------------------- US-30 : rendez-vous pour un patient
export const listPatients = wrap(async (req, res) => res.json(await rdv.listPatients(str(req.query.q))));

export const bookingOptions = wrap(async (req, res) => res.json(await rdv.listBookingOptions()));

export const listAppointments = wrap(async (req, res) => {
    res.json(
        await rdv.listAppointments({
            status: str(req.query.status),
            cliniqueId: str(req.query.clinique_id),
            from: str(req.query.from),
            to: str(req.query.to),
            ...page(req),
        })
    );
});

export const createAppointment = wrap(async (req, res) => {
    const appointment = await rdv.createAppointmentForPatient(req.body || {});
    await recordAudit(req, 'ADMIN_CREATE_APPOINTMENT', `RDV #${appointment.id} (patient #${appointment.patient_id})`);
    res.status(201).json(appointment);
});

export const cancelAppointment = wrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide');
    await rdv.cancelAppointment(id);
    await recordAudit(req, 'ADMIN_CANCEL_APPOINTMENT', `RDV #${id}`);
    res.json({ ok: true });
});

// ---------------------------------------------------------------- US-50 : synthèse pour la Direction
export const getSynthese = wrap(async (req, res) => {
    const period = await stats.parsePeriod({ from: str(req.query.from), to: str(req.query.to) }, 30);
    res.json(await stats.getSynthese(period));
});

// ---------------------------------------------------------------- US-32 / US-46 : statistiques anonymisées
export const getAnonymizedStats = wrap(async (req, res) => {
    const period = await stats.parsePeriod({ from: str(req.query.from), to: str(req.query.to) }, 365);
    res.json(await stats.getAnonymizedStats(period));
});

export const exportAnonymizedStats = wrap(async (req, res) => {
    const period = await stats.parsePeriod({ from: str(req.query.from), to: str(req.query.to) }, 365);
    const data = await stats.getAnonymizedStats(period);
    await recordAudit(req, 'ADMIN_EXPORT_STATS', `Export anonymisé ${period.from} au ${period.to}`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="medlink-statistiques-anonymisees_${period.from}_${period.to}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(stats.toCsv(data));
});

// ---------------------------------------------------------------- US-51 : suivi de la baisse des appels
export const getSuivi = wrap(async (req, res) => res.json(await stats.getSuivi(req.query.weeks)));

export const saveSemaine = wrap(async (req, res) => {
    const saved = await stats.saveSemaine(req.body || {}, req.user.id);
    await recordAudit(req, 'ADMIN_SAVE_APPELS', `Appels semaine du ${saved.semaine}`);
    res.json(saved);
});

export const saveReference = wrap(async (req, res) => {
    const saved = await stats.saveReference(req.body || {});
    await recordAudit(req, 'ADMIN_SAVE_APPELS_REFERENCE', `Référence ${saved.reference} appels/semaine`);
    res.json(saved);
});