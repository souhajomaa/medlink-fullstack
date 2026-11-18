import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';

export default function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.patient.records
      .results()
      .then(setResults)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center">Chargement...</div>;
  if (error) return <div className="rounded-lg bg-error-container p-4 text-error">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-primary">Mes résultats d'analyses</h2>
        <p className="mt-1 text-sm text-on-variant">Consultez l'historique de vos examens biologiques.</p>
      </div>

      {loading ? (
  <div className="text-center py-8 text-on-variant">
    Chargement des résultats...
  </div>
) : results.length === 0 ? (
  <div className="card py-16 text-center text-on-variant">
    Aucun résultat disponible.
  </div>
) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-outline-variant/40 bg-surface-low">
              <tr>
                <th className="px-5 py-3 font-semibold text-on-variant">Date</th>
                <th className="px-5 py-3 font-semibold text-on-variant">Examen</th>
                <th className="px-5 py-3 font-semibold text-on-variant">Résultat</th>
                <th className="px-5 py-3 font-semibold text-on-variant">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-surface-low/50">
                  <td className="px-5 py-3.5">
                    {new Date(r.result_date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-primary">{r.test_name}</td>
                  <td className="px-5 py-3.5">
                    {r.result_value} {r.unit} 
                    <span className="text-xs text-on-variant ml-2">({r.reference_range})</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={r.status === 'normal' ? 'badge-success' : 'badge-warning'}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}