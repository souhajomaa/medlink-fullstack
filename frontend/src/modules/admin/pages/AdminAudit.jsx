import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';
import { actionLabel, fmtDateTime } from '../utils';

const PAGE = 20;

export default function AdminAudit() {
    const [action, setAction] = useState('');
    const [offset, setOffset] = useState(0);
    const [data, setData] = useState({ items: [], total: 0, actions: [] });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.admin.audit({ action, limit: PAGE, offset })
            .then((d) => { setData(d); setError(''); })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [action, offset]);

    const from = data.total ? offset + 1 : 0;
    const to = Math.min(offset + PAGE, data.total);

    return (
        <div className="fade-in space-y-6">
            <div>
                <h1 className="text-3xl">Journal d'audit</h1>
                <p className="mt-1 text-on-variant">Historique en lecture seule des accès et des actions d'administration.</p>
            </div>

            {error && <div className="alert-error" role="alert">{error}</div>}

            <select className="select max-w-xs" aria-label="Filtrer par action" value={action}
                    onChange={(e) => { setOffset(0); setAction(e.target.value); }}>
                <option value="">Toutes les actions</option>
                {data.actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
            </select>

            <div className="table-container overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="table-header">
                    <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Utilisateur</th>
                        <th className="px-6 py-3">Action</th>
                        <th className="px-6 py-3">Ressource</th>
                        <th className="px-6 py-3">Adresse IP</th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading && <tr><td className="px-6 py-6" colSpan={5}>Chargement...</td></tr>}
                    {!loading && data.items.length === 0 && <tr><td className="px-6 py-6 text-on-variant" colSpan={5}>Aucune entrée.</td></tr>}
                    {data.items.map((i) => (
                        <tr key={i.id} className="table-row">
                            <td className="whitespace-nowrap px-6 py-3">{fmtDateTime(i.date_heure)}</td>
                            <td className="px-6 py-3">{i.full_name || <span className="text-on-variant">Compte supprimé</span>}</td>
                            <td className="px-6 py-3 font-medium">{actionLabel(i.action)}</td>
                            <td className="px-6 py-3 text-on-variant">{i.ressource}</td>
                            <td className="px-6 py-3 font-mono text-on-variant">{i.adresse_ip}</td>
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
        </div>
    );
}