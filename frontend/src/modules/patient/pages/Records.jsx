import { useEffect, useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';

export default function Records() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.records
      .list()
      .then(setList)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

    const isDoctor = user?.role === 'practitioner';

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-error-container p-4 text-error">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-primary">
          {isDoctor ? 'Dossiers patients' : 'Mon dossier médical'}
        </h2>
        <p className="mt-1 text-sm text-on-variant">
          {isDoctor
            ? 'Historique des consultations et diagnostics'
            : 'Vos documents et comptes-rendus médicaux'}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-on-variant">Aucun document médical trouvé.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-primary">{r.title}</h3>
                  <p className="mt-0.5 text-sm text-on-variant">
                    {isDoctor ? r.patient_name : r.doctor_name}
                    {' · '}
                    {new Date(r.record_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span className="badge-info">Compte-rendu</span>
              </div>
              {r.diagnosis && (
                <div className="mt-3 rounded-lg bg-surface-low px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-on-variant">
                    Diagnostic
                  </p>
                  <p className="mt-1 text-sm text-primary">{r.diagnosis}</p>
                </div>
              )}
              {r.notes && (
                <p className="mt-3 text-sm text-on-variant leading-relaxed">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
