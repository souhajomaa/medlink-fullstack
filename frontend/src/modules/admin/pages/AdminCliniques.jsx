import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';
import Modal from '../components/Modal';
import { plural } from '../utils';

function CliniqueForm({ initial, onSubmit, onCancel }) {
    const [form, setForm] = useState({
        nom: initial?.nom || '',
        ville: initial?.ville || '',
        adresse: initial?.adresse || '',
        telephone: initial?.telephone || '',
    });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try { await onSubmit(form); } catch (err) { setError(err.message); setSaving(false); }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <div className="alert-error">{error}</div>}
            <div>
                <label className="label" htmlFor="c-nom">Nom</label>
                <input id="c-nom" className="input" value={form.nom} onChange={set('nom')} required />
            </div>
            <div>
                <label className="label" htmlFor="c-ville">Ville</label>
                <input id="c-ville" className="input" value={form.ville} onChange={set('ville')} required />
            </div>
            <div>
                <label className="label" htmlFor="c-adresse">Adresse</label>
                <input id="c-adresse" className="input" value={form.adresse} onChange={set('adresse')} />
            </div>
            <div>
                <label className="label" htmlFor="c-tel">Téléphone</label>
                <input id="c-tel" className="input" value={form.telephone} onChange={set('telephone')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>Enregistrer</button>
            </div>
        </form>
    );
}

function PractitionersForm({ clinique, onSubmit, onCancel }) {
    const [all, setAll] = useState(null);
    const [selected, setSelected] = useState(new Set(clinique.practitioners.map((p) => p.id)));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.admin.users.list({ role: 'practitioner' }).then((d) => setAll(d.users)).catch((e) => setError(e.message));
    }, []);

    const toggle = (id) =>
        setSelected((s) => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try { await onSubmit([...selected]); } catch (err) { setError(err.message); setSaving(false); }
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            {error && <div className="alert-error">{error}</div>}
            {!all && !error && <p className="text-sm text-on-variant">Chargement...</p>}
            {all && all.length === 0 && <p className="text-sm text-on-variant">Aucun praticien. Créez d'abord un compte praticien.</p>}
            <ul className="space-y-2">
                {all?.map((p) => (
                    <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-outline-variant p-3">
                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                            <span>
                <span className="font-semibold">{p.full_name}</span>
                                {p.specialty && <span className="text-on-variant">, {p.specialty}</span>}
              </span>
                        </label>
                    </li>
                ))}
            </ul>
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving || !all}>Enregistrer</button>
            </div>
        </form>
    );
}

export default function AdminCliniques() {
    const [cliniques, setCliniques] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [modal, setModal] = useState(null); // { type: 'form' | 'practitioners', clinique? }

    const load = useCallback(async () => {
        try {
            setCliniques(await api.admin.cliniques.list());
            setError('');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const done = async (message) => {
        setModal(null);
        setNotice(message);
        await load();
    };

    const remove = async (c) => {
        if (!window.confirm(`Supprimer la clinique "${c.nom}" ?`)) return;
        try {
            await api.admin.cliniques.remove(c.id);
            await done('Clinique supprimée.');
        } catch (e) {
            setNotice('');
            setError(e.message);
        }
    };

    return (
        <div className="fade-in space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl">Cliniques</h1>
                    <p className="mt-1 text-on-variant">Établissements du réseau et praticiens affectés.</p>
                </div>
                <button className="btn-primary" onClick={() => setModal({ type: 'form' })}>Nouvelle clinique</button>
            </div>

            {notice && <div className="alert-success" role="status">{notice}</div>}
            {error && <div className="alert-error" role="alert">{error}</div>}
            {loading && <p className="text-on-variant">Chargement...</p>}

            <div className="grid gap-4 md:grid-cols-2">
                {cliniques.map((c) => (
                    <article key={c.id} className="card">
                        <h2 className="text-lg">{c.nom}</h2>
                        <p className="text-sm text-on-variant">{[c.ville, c.adresse, c.telephone].filter(Boolean).join(', ')}</p>
                        <p className="mt-4 text-sm font-semibold">{plural(c.practitioners.length, 'praticien')}</p>
                        <ul className="mt-2 flex flex-wrap gap-2">
                            {c.practitioners.map((p) => (
                                <li key={p.id} className="badge-info">{p.full_name}</li>
                            ))}
                        </ul>
                        <div className="mt-5 flex flex-wrap gap-1">
                            <button className="btn-ghost" onClick={() => setModal({ type: 'form', clinique: c })}>Modifier</button>
                            <button className="btn-ghost" onClick={() => setModal({ type: 'practitioners', clinique: c })}>Praticiens</button>
                            <button className="btn-ghost text-error" onClick={() => remove(c)}>Supprimer</button>
                        </div>
                    </article>
                ))}
            </div>

            {modal?.type === 'form' && (
                <Modal title={modal.clinique ? 'Modifier la clinique' : 'Nouvelle clinique'} onClose={() => setModal(null)}>
                    <CliniqueForm initial={modal.clinique} onCancel={() => setModal(null)}
                                  onSubmit={async (f) => {
                                      modal.clinique ? await api.admin.cliniques.update(modal.clinique.id, f) : await api.admin.cliniques.create(f);
                                      await done(modal.clinique ? 'Clinique mise à jour.' : 'Clinique créée.');
                                  }} />
                </Modal>
            )}
            {modal?.type === 'practitioners' && (
                <Modal title={`Praticiens, ${modal.clinique.nom}`} onClose={() => setModal(null)}>
                    <PractitionersForm clinique={modal.clinique} onCancel={() => setModal(null)}
                                       onSubmit={async (ids) => { await api.admin.cliniques.setPractitioners(modal.clinique.id, ids); await done('Affectations mises à jour.'); }} />
                </Modal>
            )}
        </div>
    );
}    