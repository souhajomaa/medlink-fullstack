import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';

const PAGE = 15;
const STATUS_LABEL = { pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé', cancelled: 'Annulé' };
const STATUS_BADGE = { pending: 'badge-warning', confirmed: 'badge-info', completed: 'badge-success', cancelled: 'badge-error' };
const TYPES = [
    ['consultation', 'Consultation'],
    ['suivi', 'Suivi'],
    ['urgence', 'Urgence'],
    ['teleconsultation', 'Téléconsultation'],
];

const today = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-JJ (heure locale)
const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR');

function BookingForm({ onCreated }) {
    const [options, setOptions] = useState([]);
    const [search, setSearch] = useState('');
    const [found, setFound] = useState([]);
    const [patient, setPatient] = useState(null);
    const [form, setForm] = useState({ practitioner_id: '', clinique_id: '', appointment_date: '', appointment_time: '', type: 'consultation', reason: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.admin.bookingOptions().then(setOptions).catch((e) => setError(e.message));
    }, []);

    // Recherche de patient avec anti-rebond
    useEffect(() => {
        if (patient || search.trim().length < 2) {
            setFound([]);
            return undefined;
        }
        const t = setTimeout(() => {
            api.admin.patients(search.trim()).then(setFound).catch((e) => setError(e.message));
        }, 250);
        return () => clearTimeout(t);
    }, [search, patient]);

    const practitioner = options.find((p) => String(p.id) === form.practitioner_id);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const pickPractitioner = (e) => {
        const p = options.find((o) => String(o.id) === e.target.value);
        // Une seule clinique : présélectionnée
        setForm((f) => ({ ...f, practitioner_id: e.target.value, clinique_id: p?.cliniques.length === 1 ? String(p.cliniques[0].id) : '' }));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!patient) return setError('Sélectionnez un patient');
        setSaving(true);
        setError('');
        try {
            const created = await api.admin.appointments.create({ ...form, patient_id: patient.id });
            setForm((f) => ({ ...f, appointment_date: '', appointment_time: '', reason: '' }));
            onCreated(created);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="card space-y-4">
            <h2 className="text-lg">Nouveau rendez-vous pour un patient</h2>
            {error && <div className="alert-error" role="alert">{error}</div>}

            <div>
                <label className="label" htmlFor="rv-patient">Patient</label>
                {patient ? (
                    <div className="flex items-center justify-between rounded-lg border border-outline-variant p-3">
                        <span><span className="font-semibold">{patient.full_name}</span> <span className="text-on-variant">{patient.email}</span></span>
                        <button type="button" className="btn-ghost" onClick={() => { setPatient(null); setSearch(''); }}>Changer</button>
                    </div>
                ) : (
                    <>
                        <input id="rv-patient" className="input" placeholder="Nom ou e-mail du patient (2 lettres minimum)" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
                        {found.length > 0 && (
                            <ul className="mt-2 divide-y divide-outline-variant/50 rounded-lg border border-outline-variant">
                                {found.map((p) => (
                                    <li key={p.id}>
                                        <button type="button" className="w-full px-3 py-2 text-left hover:bg-surface-container" onClick={() => setPatient(p)}>
                                            <span className="font-semibold">{p.full_name}</span> <span className="text-sm text-on-variant">{p.email}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {search.trim().length >= 2 && found.length === 0 && <p className="mt-1 text-xs text-on-variant">Aucun patient trouvé.</p>}
                    </>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="label" htmlFor="rv-prat">Praticien</label>
                    <select id="rv-prat" className="select" value={form.practitioner_id} onChange={pickPractitioner} required>
                        <option value="">Choisir...</option>
                        {options.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.specialty ? `, ${p.specialty}` : ''}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label" htmlFor="rv-clin">Clinique</label>
                    <select id="rv-clin" className="select" value={form.clinique_id} onChange={set('clinique_id')} required disabled={!practitioner}>
                        <option value="">Choisir...</option>
                        {practitioner?.cliniques.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.ville})</option>)}
                    </select>
                    {practitioner && practitioner.cliniques.length === 0 && (
                        <p className="mt-1 text-xs text-error">Ce praticien n'est affecté à aucune clinique (page Cliniques).</p>
                    )}
                </div>
                <div>
                    <label className="label" htmlFor="rv-date">Date</label>
                    <input id="rv-date" type="date" className="input" min={today()} value={form.appointment_date} onChange={set('appointment_date')} required />
                </div>
                <div>
                    <label className="label" htmlFor="rv-time">Heure</label>
                    <input id="rv-time" type="time" step="900" className="input" value={form.appointment_time} onChange={set('appointment_time')} required />
                </div>
                <div>
                    <label className="label" htmlFor="rv-type">Type</label>
                    <select id="rv-type" className="select" value={form.type} onChange={set('type')}>
                        {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="label" htmlFor="rv-reason">Motif (facultatif)</label>
                <textarea id="rv-reason" className="input" rows={2} maxLength={500} value={form.reason} onChange={set('reason')} />
            </div>

            <div className="flex justify-end">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : 'Créer le rendez-vous'}</button>
            </div>
        </form>
    );
}

export default function AdminRendezVous() {
    const [status, setStatus] = useState('');
    const [offset, setOffset] = useState(0);
    const [data, setData] = useState({ items: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        try {
            setData(await api.admin.appointments.list({ status, limit: PAGE, offset }));
            setError('');
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [status, offset]);

    useEffect(() => { load(); }, [load]);

    const created = async (a) => {
        setNotice(`Rendez-vous confirmé pour ${a.patient_name} avec ${a.practitioner_name} le ${fmtDate(a.appointment_date)} à ${a.appointment_time}.`);
        setOffset(0);
        await load();
    };

    const cancel = async (a) => {
        if (!window.confirm(`Annuler le rendez-vous de ${a.patient_name} le ${fmtDate(a.appointment_date)} à ${a.appointment_time} ?`)) return;
        try {
            await api.admin.appointments.cancel(a.id);
            setNotice('Rendez-vous annulé.');
            await load();
        } catch (e) {
            setNotice('');
            setError(e.message);
        }
    };

    const from = data.total ? offset + 1 : 0;
    const to = Math.min(offset + PAGE, data.total);

    return (
        <div className="fade-in space-y-6">
            <div>
                <h1 className="text-3xl">Rendez-vous</h1>
                <p className="mt-1 text-on-variant">Prendre un rendez-vous au nom d'un patient (par exemple après un appel téléphonique).</p>
            </div>

            {notice && <div className="alert-success" role="status">{notice}</div>}

            <BookingForm onCreated={created} />

            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg">Rendez-vous du réseau</h2>
                    <select className="select max-w-[200px]" aria-label="Filtrer par statut" value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value); }}>
                        <option value="">Tous les statuts</option>
                        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>

                {error && <div className="alert-error" role="alert">{error}</div>}

                <div className="table-container overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="table-header">
                        <tr>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3">Patient</th>
                            <th className="px-6 py-3">Praticien</th>
                            <th className="px-6 py-3">Clinique</th>
                            <th className="px-6 py-3">Statut</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                        </thead>
                        <tbody>
                        {loading && <tr><td className="px-6 py-6" colSpan={6}>Chargement...</td></tr>}
                        {!loading && data.items.length === 0 && <tr><td className="px-6 py-6 text-on-variant" colSpan={6}>Aucun rendez-vous.</td></tr>}
                        {data.items.map((a) => (
                            <tr key={a.id} className="table-row">
                                <td className="whitespace-nowrap px-6 py-3">{fmtDate(a.appointment_date)} à {a.appointment_time}</td>
                                <td className="px-6 py-3 font-medium">{a.patient_name}</td>
                                <td className="px-6 py-3">{a.practitioner_name}{a.specialty && <span className="text-on-variant">, {a.specialty}</span>}</td>
                                <td className="px-6 py-3 text-on-variant">{a.clinique_nom || '-'}</td>
                                <td className="px-6 py-3"><span className={STATUS_BADGE[a.status]}>{STATUS_LABEL[a.status]}</span></td>
                                <td className="px-6 py-3 text-right">
                                    {(a.status === 'pending' || a.status === 'confirmed') && (
                                        <button className="btn-ghost text-error" onClick={() => cancel(a)}>Annuler</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between text-sm text-on-variant">
                    <span>{from} à {to} sur {data.total}</span>
                    <div className="flex gap-2">
                        <button className="btn-outline px-4 py-2" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Précédent</button>
                        <button className="btn-outline px-4 py-2" disabled={to >= data.total} onClick={() => setOffset(offset + PAGE)}>Suivant</button>
                    </div>
                </div>
            </section>
        </div>
    );
}