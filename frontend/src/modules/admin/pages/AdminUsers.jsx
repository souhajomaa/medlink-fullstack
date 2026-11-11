import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';
import Modal from '../components/Modal';
import { ROLE_BADGE, ROLE_LABEL, generatePassword } from '../utils';

const ROLES = ['patient', 'practitioner', 'admin'];
const PASSWORD_HINT = '12 caractères minimum. Le mot de passe est temporaire : l\'utilisateur devra le changer à sa première connexion.';

function PasswordField({ value, onChange }) {
    return (
        <div>
            <label className="label" htmlFor="u-password">Mot de passe temporaire</label>
            <div className="flex gap-2">
                <input id="u-password" className="input font-mono" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" required minLength={12} />
                <button type="button" className="btn-outline px-4 py-2" onClick={() => onChange(generatePassword())}>Générer</button>
            </div>
            <p className="mt-1 text-xs text-on-variant">{PASSWORD_HINT}</p>
        </div>
    );
}

function UserForm({ initial, isSelf, onSubmit, onCancel }) {
    const editing = !!initial;
    const [form, setForm] = useState({
        full_name: initial?.full_name || '',
        email: initial?.email || '',
        role: initial?.role || 'patient',
        specialty: initial?.specialty || '',
        phone: initial?.phone || '',
        password: '',
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = { full_name: form.full_name, role: form.role, specialty: form.specialty, phone: form.phone };
            if (!editing) Object.assign(payload, { email: form.email, password: form.password });
            await onSubmit(payload);
        } catch (err) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <div className="alert-error">{error}</div>}
            <div>
                <label className="label" htmlFor="u-name">Nom complet</label>
                <input id="u-name" className="input" value={form.full_name} onChange={set('full_name')} required />
            </div>
            <div>
                <label className="label" htmlFor="u-email">Adresse e-mail</label>
                <input id="u-email" type="email" className="input" value={form.email} onChange={set('email')} disabled={editing} required />
            </div>
            <div>
                <label className="label" htmlFor="u-role">Rôle</label>
                <select id="u-role" className="select" value={form.role} onChange={set('role')} disabled={isSelf}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                {isSelf && <p className="mt-1 text-xs text-on-variant">Vous ne pouvez pas modifier votre propre rôle.</p>}
                {!editing && form.role !== 'patient' && (
                    <p className="mt-1 text-xs text-on-variant">La double authentification (TOTP) sera exigée à la première connexion.</p>
                )}
            </div>
            {form.role === 'practitioner' && (
                <div>
                    <label className="label" htmlFor="u-spec">Spécialité</label>
                    <input id="u-spec" className="input" value={form.specialty} onChange={set('specialty')} />
                </div>
            )}
            <div>
                <label className="label" htmlFor="u-phone">Téléphone</label>
                <input id="u-phone" className="input" value={form.phone} onChange={set('phone')} />
            </div>
            {!editing && <PasswordField value={form.password} onChange={(password) => setForm((f) => ({ ...f, password }))} />}
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : editing ? 'Enregistrer' : 'Créer le compte'}</button>
            </div>
        </form>
    );
}

function ResetPasswordForm({ user, onSubmit, onCancel }) {
    const [password, setPassword] = useState(generatePassword());
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try { await onSubmit(password); } catch (err) { setError(err.message); setSaving(false); }
    };
    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <div className="alert-error">{error}</div>}
            <p className="text-sm text-on-variant">Nouveau mot de passe temporaire pour <strong>{user.full_name}</strong>. Communiquez-le-lui de façon sécurisée.</p>
            <PasswordField value={password} onChange={setPassword} />
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>Réinitialiser</button>
            </div>
        </form>
    );
}

function DeleteForm({ user, onSubmit, onCancel }) {
    const [typed, setTyped] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const match = typed.trim().toLowerCase() === user.email;
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try { await onSubmit(typed); } catch (err) { setError(err.message); setSaving(false); }
    };
    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <div className="alert-error">{error}</div>}
            <div className="alert-warning">
                La suppression est définitive : le compte sera supprimé de Keycloak et de MedLink. Pour couper l'accès sans perdre l'historique, préférez la désactivation.
            </div>
            <div>
                <label className="label" htmlFor="u-confirm">Pour confirmer, saisissez l'adresse <span className="font-mono">{user.email}</span></label>
                <input id="u-confirm" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={!match || saving}>Supprimer définitivement</button>
            </div>
        </form>
    );
}

export default function AdminUsers() {
    const { user: me } = useAuth();
    const [role, setRole] = useState('');
    const [q, setQ] = useState('');
    const [data, setData] = useState({ users: [], keycloak_ok: true });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [modal, setModal] = useState(null); // { type: 'create' | 'edit' | 'reset' | 'delete', user? }

    const load = useCallback(async () => {
        try {
            setData(await api.admin.users.list({ role, q }));
            setError('');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [role, q]);

    useEffect(() => {
        const t = setTimeout(load, 250); // anti-rebond sur la recherche
        return () => clearTimeout(t);
    }, [load]);

    const done = async (message) => {
        setModal(null);
        setNotice(message);
        await load();
    };

    const toggle = async (u) => {
        try {
            await api.admin.users.setStatus(u.id, !u.enabled);
            setNotice(`Compte de ${u.full_name} ${u.enabled ? 'désactivé' : 'réactivé'}.`);
            await load();
        } catch (e) {
            setError(e.message);
        }
    };

    const sync = async () => {
        try {
            const r = await api.admin.users.sync();
            setNotice(`Synchronisation terminée : ${r.linked} rattaché(s), ${r.created} créé(s), ${r.updated} rôle(s) mis à jour.`);
            await load();
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <div className="fade-in space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl">Utilisateurs</h1>
                    <p className="mt-1 text-on-variant">Comptes et rôles, gérés dans Keycloak.</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-outline" onClick={sync}>Synchroniser Keycloak</button>
                    <button className="btn-primary" onClick={() => setModal({ type: 'create' })}>Nouvel utilisateur</button>
                </div>
            </div>

            {notice && <div className="alert-success" role="status">{notice}</div>}
            {error && <div className="alert-error" role="alert">{error}</div>}
            {!data.keycloak_ok && <div className="alert-warning">Keycloak est injoignable : l'état des comptes (actif / désactivé) n'est pas disponible.</div>}

            <div className="flex flex-wrap gap-3">
                <input className="input max-w-xs" placeholder="Rechercher un nom ou un e-mail" aria-label="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="select max-w-[200px]" aria-label="Filtrer par rôle" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="">Tous les rôles</option>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
            </div>

            <div className="table-container overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="table-header">
                    <tr>
                        <th className="px-6 py-3">Nom</th>
                        <th className="px-6 py-3">Rôle</th>
                        <th className="px-6 py-3">État</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading && <tr><td className="px-6 py-6" colSpan={4}>Chargement...</td></tr>}
                    {!loading && data.users.length === 0 && <tr><td className="px-6 py-6 text-on-variant" colSpan={4}>Aucun utilisateur.</td></tr>}
                    {data.users.map((u) => {
                        const isSelf = u.id === me?.id;
                        return (
                            <tr key={u.id} className="table-row">
                                <td className="px-6 py-3">
                                    <p className="font-semibold">{u.full_name}{isSelf && <span className="ml-2 text-xs font-normal text-on-variant">(vous)</span>}</p>
                                    <p className="text-on-variant">{u.email}{u.specialty ? `, ${u.specialty}` : ''}</p>
                                </td>
                                <td className="px-6 py-3"><span className={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role]}</span></td>
                                <td className="px-6 py-3">
                                    {!u.linked ? <span className="badge-warning">Non rattaché</span>
                                        : u.enabled === null ? <span className="text-on-variant">Inconnu</span>
                                            : u.enabled ? <span className="badge-success">Actif</span>
                                                : <span className="badge-error">Désactivé</span>}
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex flex-wrap justify-end gap-1">
                                        <button className="btn-ghost whitespace-nowrap px-2" onClick={() => setModal({ type: 'edit', user: u })}>Modifier</button>
                                        {u.linked && <button className="btn-ghost whitespace-nowrap px-2" onClick={() => setModal({ type: 'reset', user: u })}>Mot de passe</button>}
                                        {u.linked && !isSelf && u.enabled !== null && (
                                            <button className="btn-ghost whitespace-nowrap px-2" onClick={() => toggle(u)}>{u.enabled ? 'Désactiver' : 'Activer'}</button>
                                        )}
                                        {!isSelf && <button className="btn-ghost whitespace-nowrap px-2 text-error" onClick={() => setModal({ type: 'delete', user: u })}>Supprimer</button>}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>

            {modal?.type === 'create' && (
                <Modal title="Nouvel utilisateur" onClose={() => setModal(null)}>
                    <UserForm onCancel={() => setModal(null)} onSubmit={async (p) => { await api.admin.users.create(p); await done('Compte créé dans Keycloak.'); }} />
                </Modal>
            )}
            {modal?.type === 'edit' && (
                <Modal title="Modifier l'utilisateur" onClose={() => setModal(null)}>
                    <UserForm initial={modal.user} isSelf={modal.user.id === me?.id} onCancel={() => setModal(null)}
                              onSubmit={async (p) => { await api.admin.users.update(modal.user.id, p); await done('Compte mis à jour.'); }} />
                </Modal>
            )}
            {modal?.type === 'reset' && (
                <Modal title="Réinitialiser le mot de passe" onClose={() => setModal(null)}>
                    <ResetPasswordForm user={modal.user} onCancel={() => setModal(null)}
                                       onSubmit={async (pw) => { await api.admin.users.resetPassword(modal.user.id, pw); await done('Mot de passe temporaire défini.'); }} />
                </Modal>
            )}
            {modal?.type === 'delete' && (
                <Modal title="Supprimer le compte" onClose={() => setModal(null)}>
                    <DeleteForm user={modal.user} onCancel={() => setModal(null)}
                                onSubmit={async (email) => { await api.admin.users.remove(modal.user.id, email); await done('Compte supprimé.'); }} />
                </Modal>
            )}
        </div>
    );
}