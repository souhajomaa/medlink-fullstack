import * as svc from './admin.service.js';
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

const idParam = (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Identifiant invalide');
    return id;
};

export const getStats = wrap(async (req, res) => res.json(await svc.getStats()));

export const listUsers = wrap(async (req, res) => {
    const { role, q } = req.query;
    if (role && !svc.ROLES.includes(role)) throw new HttpError(400, 'Rôle invalide');
    res.json(await svc.listUsers({ role: role || null, q: typeof q === 'string' && q.trim() ? q.trim() : null }));
});

export const createUser = wrap(async (req, res) => {
    const user = await svc.createUser(req.body || {});
    await svc.recordAudit(req, 'ADMIN_CREATE_USER', `Utilisateur #${user.id} (${user.role})`);
    res.status(201).json(user);
});

export const updateUser = wrap(async (req, res) => {
    const id = idParam(req);
    const before = req.body?.role;
    const user = await svc.updateUser(id, req.user.id, req.body || {});
    await svc.recordAudit(req, before ? 'ADMIN_UPDATE_USER_ROLE' : 'ADMIN_UPDATE_USER', `Utilisateur #${id}`);
    res.json(user);
});

export const setUserStatus = wrap(async (req, res) => {
    const id = idParam(req);
    await svc.setUserStatus(id, req.user.id, req.body?.enabled);
    await svc.recordAudit(req, req.body.enabled ? 'ADMIN_ENABLE_USER' : 'ADMIN_DISABLE_USER', `Utilisateur #${id}`);
    res.json({ ok: true });
});

export const resetUserPassword = wrap(async (req, res) => {
    const id = idParam(req);
    await svc.resetUserPassword(id, req.body?.password);
    await svc.recordAudit(req, 'ADMIN_RESET_PASSWORD', `Utilisateur #${id}`);
    res.json({ ok: true });
});

export const deleteUser = wrap(async (req, res) => {
    const id = idParam(req);
    await svc.deleteUser(id, req.user.id, req.body?.confirm_email);
    await svc.recordAudit(req, 'ADMIN_DELETE_USER', `Utilisateur #${id}`);
    res.json({ ok: true });
});

export const syncUsers = wrap(async (req, res) => {
    const result = await svc.syncFromKeycloak();
    await svc.recordAudit(req, 'ADMIN_SYNC_KEYCLOAK', `Keycloak (${result.total} comptes)`);
    res.json(result);
});

export const listCliniques = wrap(async (req, res) => res.json(await svc.listCliniques()));

export const createClinique = wrap(async (req, res) => {
    const c = await svc.createClinique(req.body || {});
    await svc.recordAudit(req, 'ADMIN_CREATE_CLINIQUE', `Clinique #${c.id}`);
    res.status(201).json(c);
});

export const updateClinique = wrap(async (req, res) => {
    const c = await svc.updateClinique(idParam(req), req.body || {});
    await svc.recordAudit(req, 'ADMIN_UPDATE_CLINIQUE', `Clinique #${c.id}`);
    res.json(c);
});

export const deleteClinique = wrap(async (req, res) => {
    const c = await svc.deleteClinique(idParam(req));
    await svc.recordAudit(req, 'ADMIN_DELETE_CLINIQUE', `Clinique #${c.id}`);
    res.json({ ok: true });
});

export const setCliniquePractitioners = wrap(async (req, res) => {
    const c = await svc.setCliniquePractitioners(idParam(req), req.body?.practitioner_ids);
    await svc.recordAudit(req, 'ADMIN_ASSIGN_PRACTITIONERS', `Clinique #${c.id}`);
    res.json({ ok: true });
});

export const listAudit = wrap(async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const action = typeof req.query.action === 'string' && req.query.action ? req.query.action : null;
    res.json(await svc.listAudit({ action, limit, offset }));
});