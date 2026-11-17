import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';
import { plural } from '../utils';

const iso = (d) => d.toLocaleDateString('en-CA'); // AAAA-MM-JJ (heure locale)
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const fmtDate = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('fr-FR');
const fmtPct = (v) => (v === null || v === undefined ? '-' : `${String(v).replace('.', ',')} %`);

const PRESETS = [
    { label: '30 jours', days: 30 },
    { label: '90 jours', days: 90 },
    { label: '12 mois', days: 365 },
];

function Kpi({ label, value, hint }) {
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

function Bars({ rows, labelKey, valueKey }) {
    const max = Math.max(1, ...rows.map((r) => r[valueKey]));
    return (
        <ul className="space-y-3">
            {rows.map((r) => (
                <li key={r[labelKey]}>
                    <div className="mb-1 flex justify-between text-sm">
                        <span>{r[labelKey]}</span>
                        <span className="font-semibold">{r[valueKey]}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(r[valueKey] / max) * 100}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

export default function AdminStats() {
    const [range, setRange] = useState({ from: daysAgo(29), to: iso(new Date()) });
    const [synthese, setSynthese] = useState(null);
    const [anon, setAnon] = useState(null);
    const [error, setError] = useState('');
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!range.from || !range.to) return;
        setError('');
        api.admin.synthese(range).then(setSynthese).catch((e) => setError(e.message));
        api.admin.anonymizedStats(range).then(setAnon).catch((e) => setError(e.message));
    }, [range]);

    const exportCsv = async () => {
        setExporting(true);
        setError('');
        try {
            await api.admin.exportStats(range);
        } catch (e) {
            setError(e.message);
        } finally {
            setExporting(false);
        }
    };

    const k = synthese?.kpis;
    const variation = k?.variation_pct;

    return (
        <div className="fade-in space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl">Synthèse d'activité</h1>
                    <p className="mt-1 text-on-variant">
                        Rapport pour la Direction{synthese && <>, du {fmtDate(synthese.period.from)} au {fmtDate(synthese.period.to)} ({plural(synthese.period.days, 'jour')})</>}.
                    </p>
                </div>
                <button className="btn-outline print:hidden" onClick={() => window.print()}>Imprimer / PDF</button>
            </div>

            <div className="flex flex-wrap items-end gap-3 print:hidden">
                <div className="flex gap-2">
                    {PRESETS.map((p) => (
                        <button key={p.days} className="btn-outline px-4 py-2" onClick={() => setRange({ from: daysAgo(p.days - 1), to: iso(new Date()) })}>
                            {p.label}
                        </button>
                    ))}
                </div>
                <div>
                    <label className="label" htmlFor="st-from">Du</label>
                    <input id="st-from" type="date" className="input" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                </div>
                <div>
                    <label className="label" htmlFor="st-to">Au</label>
                    <input id="st-to" type="date" className="input" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                </div>
            </div>

            {error && <div className="alert-error" role="alert">{error}</div>}

            {!synthese && !error && (
                <div className="flex justify-center py-16">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            )}

            {synthese && (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Kpi
                            label="Rendez-vous"
                            value={k.rdv_total}
                            hint={variation === null ? 'Pas de période précédente comparable' : `${variation > 0 ? '+' : ''}${fmtPct(variation)} par rapport à la période précédente (${synthese.previous.rdv_total})`}
                        />
                        <Kpi label="Taux de réalisation" value={fmtPct(k.taux_realisation_pct)} hint={`${plural(k.par_statut.completed, 'terminé')}`} />
                        <Kpi label="Taux d'annulation" value={fmtPct(k.taux_annulation_pct)} hint={`${plural(k.par_statut.cancelled, 'annulé')}`} />
                        <Kpi
                            label="Patients actifs"
                            value={k.patients_actifs}
                            hint={`${plural(k.nouveaux_comptes.patient, 'nouveau patient')}, ${plural(k.nouveaux_comptes.practitioner, 'nouveau praticien')}`}
                        />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <section className="card">
                            <h2 className="mb-4 text-lg">Rendez-vous par mois</h2>
                            {synthese.par_mois.length === 0 ? <p className="text-sm text-on-variant">Aucune donnée.</p> : <Bars rows={synthese.par_mois} labelKey="mois" valueKey="rdv" />}
                        </section>
                        <section className="card">
                            <h2 className="mb-4 text-lg">Rendez-vous par spécialité</h2>
                            {synthese.par_specialite.length === 0 ? <p className="text-sm text-on-variant">Aucune donnée.</p> : <Bars rows={synthese.par_specialite} labelKey="specialite" valueKey="rdv" />}
                        </section>
                    </div>

                    <section className="table-container overflow-x-auto">
                        <h2 className="px-6 pt-5 text-lg">Activité par clinique</h2>
                        <table className="mt-3 w-full text-left text-sm">
                            <thead className="table-header">
                            <tr>
                                <th className="px-6 py-3">Clinique</th>
                                <th className="px-6 py-3">Rendez-vous</th>
                                <th className="px-6 py-3">Réalisés</th>
                                <th className="px-6 py-3">Annulés</th>
                                <th className="px-6 py-3">Patients</th>
                            </tr>
                            </thead>
                            <tbody>
                            {synthese.par_clinique.length === 0 && <tr><td className="px-6 py-6 text-on-variant" colSpan={5}>Aucune donnée.</td></tr>}
                            {synthese.par_clinique.map((c) => (
                                <tr key={c.clinique} className="table-row">
                                    <td className="px-6 py-3 font-medium">{c.clinique}</td>
                                    <td className="px-6 py-3">{c.rdv}</td>
                                    <td className="px-6 py-3">{c.realises}</td>
                                    <td className="px-6 py-3">{c.annules}</td>
                                    <td className="px-6 py-3">{c.patients}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </section>
                </>
            )}

            <section className="card space-y-4 print:hidden">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg">Export de statistiques anonymisées</h2>
                        <p className="mt-1 text-sm text-on-variant">Fichier CSV destiné à un usage externe (partenaires, Direction). Il ne contient aucune donnée personnelle.</p>
                    </div>
                    <button className="btn-primary" onClick={exportCsv} disabled={exporting || !anon}>{exporting ? 'Export...' : 'Télécharger le CSV'}</button>
                </div>

                {anon && (
                    <>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-on-variant">
                            {anon.rules.map((r) => <li key={r}>{r}</li>)}
                        </ul>
                        <p className="text-sm">
                            {plural(anon.rows.length, 'ligne')}, dont {anon.masked_rows} masquée{anon.masked_rows > 1 ? 's' : ''} (effectif inférieur à {anon.min_cell}).
                        </p>
                        <div className="table-container overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="table-header">
                                <tr>
                                    <th className="px-4 py-2">Mois</th>
                                    <th className="px-4 py-2">Clinique</th>
                                    <th className="px-4 py-2">Spécialité</th>
                                    <th className="px-4 py-2">Statut</th>
                                    <th className="px-4 py-2">RDV</th>
                                    <th className="px-4 py-2">Patients</th>
                                </tr>
                                </thead>
                                <tbody>
                                {anon.rows.slice(0, 10).map((r, i) => (
                                    <tr key={i} className="table-row">
                                        <td className="px-4 py-2">{r.periode}</td>
                                        <td className="px-4 py-2">{r.clinique}</td>
                                        <td className="px-4 py-2">{r.specialite}</td>
                                        <td className="px-4 py-2">{r.statut}</td>
                                        <td className="px-4 py-2">{r.nb_rdv ?? `<${anon.min_cell}`}</td>
                                        <td className="px-4 py-2">{r.nb_patients ?? `<${anon.min_cell}`}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                        {anon.rows.length > 10 && <p className="text-xs text-on-variant">Aperçu des 10 premières lignes : le fichier contient les {anon.rows.length} lignes.</p>}
                    </>
                )}
            </section>
        </div>
    );
}