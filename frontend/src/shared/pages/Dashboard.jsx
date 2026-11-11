import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { api } from '../../shared/api/axiosConfig';

function StatCard({ label, value, icon, color }) {
  return (
      <div className="stat-card">
        <div className={`stat-icon ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-3xl font-bold text-on-surface">{value}</p>
          <p className="text-sm text-on-variant mt-1">{label}</p>
        </div>
      </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: 'badge-warning',
    confirmed: 'badge-success',
    cancelled: 'badge-error',
    completed: 'badge-info',
  };
  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    cancelled: 'Annulé',
    completed: 'Terminé',
  };
  return <span className={map[status] || 'badge-info'}>{labels[status] || status}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard()
        .then(setData)
        .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <div className="alert-error">{error}</div>;
  }

  if (!data) {
    return (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
    );
  }

  const isPatient = user?.role === 'patient';

  return (
      <div className="space-y-8 fade-in">
        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          {isPatient ? (
              <>
                <StatCard label="RDV à venir" value={data.stats.upcoming_appointments} icon="📅" color="bg-primary-50 text-primary" />
                <StatCard label="Documents médicaux" value={data.stats.medical_records} icon="📋" color="bg-secondary-container text-secondary" />
                <StatCard label="Résultats d'analyses" value={data.stats.lab_results} icon="🧪" color="bg-surface-container text-on-surface" />
              </>
          ) : (
              <>
                  <StatCard label="RDV aujourd'hui" value={data.stats.today_appointments} icon="📅" color="bg-primary-50 text-primary" />
                  <StatCard label="En attente" value={data.stats.pending_appointments} icon="⏳" color="bg-warning-container text-warning" />
                <StatCard label="Patients suivis" value={data.stats.total_patients} icon="👥" color="bg-secondary-container text-secondary" />
              </>
          )}
        </div>

        {/* Liste des RDV */}
        <div className="card">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-xl font-bold text-on-surface">
              {isPatient ? 'Prochains rendez-vous' : 'Agenda du jour'}
            </h3>
            <Link to="/app/appointments" className="btn-ghost text-sm">
              Voir tout →
            </Link>
          </div>

          {(isPatient ? data.upcoming : data.today)?.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-4xl mb-3">📅</p>
                <p className="text-on-variant">
                  {isPatient ? 'Aucun rendez-vous à venir.' : 'Aucun rendez-vous prévu aujourd\'hui.'}
                </p>
              </div>
          ) : (
              <div className="space-y-4">
                {(isPatient ? data.upcoming : data.today).map((a) => (
                    <div key={a.id} className="table-row flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary font-semibold">
                          {isPatient ? '👨‍⚕️' : '👤'}
                        </div>
                        <div>
                          <p className="font-semibold text-on-surface">
                            {isPatient ? a.doctor_name : a.patient_name}
                          </p>
                          <p className="text-sm text-on-variant">
                            {isPatient && a.specialty && `${a.specialty} · `}
                            {a.reason || a.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-on-surface">
                            {new Date(a.appointment_date).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-sm text-on-variant">
                            {a.appointment_time?.slice(0, 5)}
                          </p>
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                ))}
              </div>
          )}
        </div>

        {/* Actions rapides */}
        {isPatient && (
            <div className="grid gap-6 md:grid-cols-2">
              <Link to="/app/book" className="card-hover flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-2xl text-white">
                  ➕
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-on-surface">Prendre un rendez-vous</p>
                  <p className="text-sm text-on-variant">Consultez les disponibilités</p>
                </div>
              </Link>
              <Link to="/app/results" className="card-hover flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-2xl text-white">
                  🧪
                </div>
                <div>
                  <p className="font-display text-lg font-bold text-on-surface">Mes résultats</p>
                  <p className="text-sm text-on-variant">Analyses et bilans</p>
                </div>
              </Link>
            </div>
        )}
      </div>
  );
}