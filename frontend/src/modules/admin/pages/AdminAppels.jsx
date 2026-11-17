import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';

const fmtDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const fmtPct = (v) => (v === null || v === undefined ? '-' : `${String(v).replace('.', ',')} %`);
const today = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-JJ (heure locale)

function Card({ label, value, hint }) {
    return (
        <div className="stat-card">
            <div>
                <p className="text-3xl font-bold text-on-surface">{value}</p>
                <p className="mt-1 text-sm text-on-variant">{label}</p>
                {hint && <p className="mt-1 text-xs text-on-variant">{hint}</p>}
            </div>
        </div>
    );
}

export default function AdminAppels() {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [ref, setRef] = useState({ nb_appels_hebdo: '', objectif_baisse_pct: '' });
    const [week, setWeek] = useState({ semaine: today(), nb_appels: '', note: '' });

    const load = useCallback(async () => {
        try {
            const d = await api.admin.appels.get({ weeks: 12 });
            setData(d);
            setRef({ nb_appels_hebdo: d.reference ?? '', objectif_baisse_pct: d.objectif_baisse_pct ?? '' });
            setError('');
        } catch (e) {
            setError(e.message);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const saveRef = async (e) => {
        e.preventDefault();
        setNotice('');
        try {
            await api.admin.appels.saveReference({ nb_appels_hebdo: Number(ref.nb_appels_hebdo), objectif_baisse_pct: ref.objectif_baisse_pct === '' ? null : Number(ref.objectif_baisse_pct) });
            setNotice('Référence enregistrée.');
            await load();
        } catch (err) {
            setError(err.message);
        }
    };

    const saveWeek = async (e) => {
        e.preventDefault();
        setNotice('');
        try {
            const saved = await api.admin.appels.saveWeek({ semaine: week.semaine, nb_appels: Number(week.nb_appels), note: week.note });
            setNotice(`Semaine du ${fmtDate(saved.semaine)} enregistrée.`);
            setWeek((w) => ({ ...w, nb_appels: '', note: '' }));
            await load();
        } catch (err) {
            setError(err.message);
        }
    };

    if (!data && !error) {
        return (
            <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    const max = data ? Math.max(1, ...data.semaines.flatMap((s) => [s.nb_appels ?? 0, s.rdv_en_ligne])) : 1;
    const r = data?.resume;
    const goalReached = data?.objectif_baisse_pct != null && r?.baisse_pct != null && r.baisse_pct >= data.objectif_baisse_pct;

    return (
        <div className="fade-in space-y-8">
            <div>
                <h1 className="text-3xl">Suivi de la baisse des appels</h1>
                <p className="mt-1 text-on-variant">Compare les appels téléphoniques reçus par semaine à une référence, en regard des rendez-vous pris sur le portail.</p>
            </div>

            {notice && <div className="alert-success" role="status">{notice}</div>}
            {error && <div className="alert-error" role="alert">{error}</div>}

            {data && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Card label="Appels par semaine (référence)" value={data.reference ?? '-'} />
                        <Card label="Moyenne des 4 dernières semaines" value={r.moyenne_recente ?? '-'} hint={`${r.semaines_renseignees} semaine(s) renseignée(s)`} />
                        <Card label="Baisse constatée" value={fmtPct(r.baisse_pct)} hint="par rapport à la référence" />
                        <Card
                            label="Objectif de baisse"
                            value={data.objectif_baisse_pct != null ? fmtPct(data.objectif_baisse_pct) : '-'}
                            hint={data.objectif_baisse_pct != null && r.baisse_pct != null ? (goalReached ? 'Objectif atteint' : 'Objectif non atteint') : undefined}
                        />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <form onSubmit={saveRef} className="card space-y-4">
                            <h2 className="text-lg">Situation de référence</h2>
                            <p className="text-sm text-on-variant">Nombre moyen d'appels par semaine avant la mise en service du portail.</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="label" htmlFor="ap-ref">Appels par semaine</label>
                                    <input id="ap-ref" type="number" min="1" className="input" value={ref.nb_appels_hebdo} onChange={(e) => setRef((x) => ({ ...x, nb_appels_hebdo: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="label" htmlFor="ap-obj">Objectif de baisse en % (facultatif)</label>
                                    <input id="ap-obj" type="number" min="1" max="100" className="input" value={ref.objectif_baisse_pct} onChange={(e) => setRef((x) => ({ ...x, objectif_baisse_pct: e.target.value }))} />
                                </div>
                            </div>
                            <div className="flex justify-end"><button type="submit" className="btn-primary">Enregistrer</button></div>
                        </form>

                        <form onSubmit={saveWeek} className="card space-y-4">
                            <h2 className="text-lg">Saisir une semaine</h2>
                            <p className="text-sm text-on-variant">Choisissez un jour de la semaine concernée : elle est ramenée au lundi.</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="label" htmlFor="ap-sem">Semaine</label>
                                    <input id="ap-sem" type="date" max={today()} className="input" value={week.semaine} onChange={(e) => setWeek((w) => ({ ...w, semaine: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="label" htmlFor="ap-nb">Appels reçus</label>
                                    <input id="ap-nb" type="number" min="0" className="input" value={week.nb_appels} onChange={(e) => setWeek((w) => ({ ...w, nb_appels: e.target.value }))} required />
                                </div>
                            </div>
                            <div>
                                <label className="label" htmlFor="ap-note">Note (facultatif)</label>
                                <input id="ap-note" className="input" maxLength={300} value={week.note} onChange={(e) => setWeek((w) => ({ ...w, note: e.target.value }))} />
                            </div>
                            <div className="flex justify-end"><button type="submit" className="btn-primary">Enregistrer la semaine</button></div>
                        </form>
                    </div>

                    <section className="card">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-lg">12 dernières semaines</h2>
                            <p className="flex items-center gap-4 text-xs text-on-variant">
                                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-warning" /> Appels</span>
                                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-primary" /> RDV pris sur le portail</span>
                            </p>
                        </div>
                        <ul className="space-y-3">
                            {data.semaines.map((s) => (
                                <li key={s.semaine} className="grid grid-cols-[64px_1fr_64px] items-center gap-3 text-sm">
                                    <span className="text-on-variant">{fmtDate(s.semaine)}</span>
                                    <div className="space-y-1">
                                        <div className="h-2 rounded-full bg-surface-container">
                                            <div className="h-2 rounded-full bg-warning" style={{ width: `${((s.nb_appels ?? 0) / max) * 100}%` }} />
                                        </div>
                                        <div className="h-2 rounded-full bg-surface-container">
                                            <div className="h-2 rounded-full bg-primary" style={{ width: `${(s.rdv_en_ligne / max) * 100}%` }} />
                                        </div>
                                    </div>
                                    <span className="text-right text-xs text-on-variant">{s.nb_appels ?? '-'} / {s.rdv_en_ligne}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className="table-container overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="table-header">
                            <tr>
                                <th className="px-6 py-3">Semaine du</th>
                                <th className="px-6 py-3">Appels</th>
                                <th className="px-6 py-3">RDV sur le portail</th>
                                <th className="px-6 py-3">Baisse vs référence</th>
                                <th className="px-6 py-3">Note</th>
                            </tr>
                            </thead>
                            <tbody>
                            {[...data.semaines].reverse().map((s) => (
                                <tr key={s.semaine} className="table-row">
                                    <td className="px-6 py-3">{fmtDate(s.semaine)}</td>
                                    <td className="px-6 py-3">{s.nb_appels ?? <span className="text-on-variant">Non saisi</span>}</td>
                                    <td className="px-6 py-3">{s.rdv_en_ligne}</td>
                                    <td className="px-6 py-3">{fmtPct(s.baisse_pct)}</td>
                                    <td className="px-6 py-3 text-on-variant">{s.note || ''}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}