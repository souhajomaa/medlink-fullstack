import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../shared/api/axiosConfig';
import { actionLabel, fmtDateTime, plural } from '../utils';

function StatCard({ label, value, icon, color, hint }) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${color}`}>{icon}</div>
            <div>
                <p className="text-3xl font-bold text-on-surface">{value}</p>
                <p className="mt-1 text-sm text-on-variant">{label}</p>
                {hint && <p className="mt-1 text-xs text-on-variant">{hint}</p>}
            </div>
        </div>
    );
}

const STATUS = [
    { key: 'pending', label: 'En attente', bar: 'bg-warning' },
    { key: 'confirmed', label: 'Confirmés', bar: 'bg-secondary' },
    { key: 'completed', label: 'Terminés', bar: 'bg-primary' },
    { key: 'cancelled', label: 'Annulés', bar: 'bg-error' },
];

export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.admin.stats().then(setData).catch((e) => setError(e.message));
    }, []);

    if (error) return <div className="alert-error">{error}</div>;
    if (!data) {
        return (
            <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    const { users, appointments, cliniques, audit } = data;

    return (
        <div className="fade-in space-y-8">
            <div>
                <h1 className="text-3xl">Tableau de bord administrateur</h1>
                <p className="mt-1 text-on-variant">Supervision des comptes et des {cliniques.length} cliniques du réseau.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Comptes"
                    value={users.total}
                    icon="👥"
                    color="bg-primary-50 text-primary"
                    hint={`${plural(users.patient, 'patient')}, ${plural(users.practitioner, 'praticien')}, ${plural(users.admin, 'admin')}`}
                />
                <StatCard label="RDV aujourd'hui" value={appointments.today} icon="📅" color="bg-secondary-container text-secondary" />
                <StatCard label="RDV en attente" value={appointments.pending} icon="⏳" color="bg-surface-container text-on-surface" />
                <StatCard label="Cliniques" value={cliniques.length} icon="🏥" color="bg-primary-50 text-primary" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="card">
                    <h2 className="mb-4 text-lg">Rendez-vous par statut</h2>
                    <ul className="space-y-3">
                        {STATUS.map((s) => {
                            const n = appointments[s.key];
                            const pct = appointments.total ? Math.round((n / appointments.total) * 100) : 0;
                            return (
                                <li key={s.key}>
                                    <div className="mb-1 flex justify-between text-sm">
                                        <span>{s.label}</span>
                                        <span className="font-semibold">{n}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-surface-container">
                                        <div className={`h-2 rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                <section className="card">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg">Supervision par clinique</h2>
                        <Link to="/app/admin/cliniques" className="btn-ghost text-sm">Gérer</Link>
                    </div>
                    <ul className="divide-y divide-outline-variant/50">
                        {cliniques.map((c) => (
                            <li key={c.id} className="py-3">
                                <p className="font-semibold">{c.nom} <span className="font-normal text-on-variant">({c.ville})</span></p>
                                <p className="mt-1 text-sm text-on-variant">
                                    {plural(c.praticiens, 'praticien')}, {plural(c.patients, 'patient')}, {plural(c.rdv_a_venir, 'RDV')} à venir
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            <section className="table-container">
                <div className="flex items-center justify-between px-6 pt-5">
                    <h2 className="text-lg">Dernières actions</h2>
                    <Link to="/app/admin/audit" className="btn-ghost text-sm">Voir tout</Link>
                </div>
                <div className="mt-3">
                    {audit.length === 0 && <p className="px-6 pb-6 text-sm text-on-variant">Aucune action enregistrée.</p>}
                    {audit.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/50 px-6 py-3 text-sm last:border-b-0">
                            <span className="font-medium">{actionLabel(a.action)}</span>
                            <span className="text-on-variant">{a.ressource}</span>
                            <span className="text-on-variant">{a.full_name || 'Compte supprimé'}</span>
                            <span className="text-on-variant">{fmtDateTime(a.date_heure)}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}