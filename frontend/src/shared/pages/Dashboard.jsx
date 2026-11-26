import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/context/AuthContext';
import { api } from '../../shared/api/axiosConfig';
import toast from 'react-hot-toast';

// Carte statistique
function StatCard({ label, value, icon, bgIcon, textIcon, subtext }) {
  return (
    <div className="stat-card group hover:-translate-y-1 hover:border-primary/30 bg-white p-6 rounded-xl border border-gray-100 shadow-sm transition-all duration-300">
      <div className={`stat-icon w-12 h-12 flex items-center justify-center rounded-lg text-2xl mb-4 ${bgIcon} ${textIcon}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900 group-hover:scale-105 transition-transform origin-left">
          {value ?? 0}
        </p>
        {subtext && (
          <p className="text-xs text-gray-400 mt-1 font-medium">{subtext}</p>
        )}
      </div>
    </div>
  );
}

// Badge de statut
function StatusBadge({ status }) {
  const map = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    confirmed: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const labels = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    cancelled: 'Annulé',
    completed: 'Terminé',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || map.completed}`}>
      {labels[status] || status}
    </span>
  );
}

function checkReminders(appointments) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const reminder = appointments.find(a =>
    a.appointment_date?.startsWith(tomorrowStr) &&
    a.status !== 'cancelled'
  );

  if (reminder) {
    toast(`Rappel : RDV avec ${reminder.doctor_name} demain � ${reminder.appointment_time?.slice(0, 5) || '--:--'}`, {
      duration: 6000,
      icon: '??',
    });
  }
}
export default function Dashboard() {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

    useEffect(() => {
    api.dashboard()
        .then((responseData) => {
          setData(responseData); // On met les données dans l'état
          
          // On vérifie les rappels si l'utilisateur est un patient
          if (user?.role === 'patient' && responseData.upcoming) {
            checkReminders(responseData.upcoming);
          }
        })
        .catch((err) => setError(err.message));
  }, [user]);

    // Fonction pour vérifier les rappels
  const checkReminders = (appointments) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // On regarde s'il y a un RDV demain
    const reminder = appointments.find(a => 
      a.appointment_date.startsWith(tomorrowStr) && 
      a.status !== 'cancelled'
    );

    if (reminder) {
      toast(`🔔 Rappel : RDV avec ${reminder.doctor_name} demain à ${reminder.appointment_time.slice(0, 5)}`, {
        duration: 6000,
        icon: '📅',
      });
    }
  };
  // 1. DÉCLARATION DES RÔLES (Doit être fait AVANT le useEffect et les returns)
  const isPatient = user?.role === 'patient';
  const isPractitioner = user?.role === 'practitioner';
  const isAdmin = user?.role === 'admin';

  // 2. CHARGEMENT DES DONNÉES
  useEffect(() => {
    // L'admin n'a pas de données ici : /api/dashboard lui renvoie 403.
    if (!user || isAdmin) return;

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        if (isPractitioner) {
          const response = await api.practitioner.dashboard();
          setData({
            stats: response.stats || {},
            today: response.today || [],
          });
        } else {
          const response = await api.dashboard();
          setData(response);

          if (isPatient && response.upcoming) {
            checkReminders(response.upcoming);
          }
        }
      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
        setError(err.message || 'Impossible de charger les données du tableau de bord.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [user, isAdmin, isPractitioner]);

  // 3. RENDU CONDITIONNEL

  // Le tableau de bord administrateur est géré par le module admin
  if (isAdmin) {
    return (
      <div className="p-6 text-gray-600 bg-white rounded-xl shadow-sm m-6">
        <p>Le tableau de bord administrateur est géré par le module admin.</p>
        <Link to="/app/admin/users" className="text-primary hover:underline mt-2 inline-block">
          Aller au panneau d'administration →
        </Link>
      </div>
    );
  }

  // Chargement
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
        <p className="text-gray-500 font-medium">Chargement de votre espace...</p>
      </div>
    );
  }

  // Erreur
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl m-6">
        ⚠️ {error}
      </div>
    );
  }

  const displayName = isPatient
    ? user?.full_name
    : `Dr. ${user?.full_name || ''}`;

  // Données adaptées au rôle
  const stats = data?.stats || {};
  const appointments = isPatient ? (data?.upcoming || []) : (data?.today || []);

  return (
    <div className="space-y-8 fade-in p-6">
      {/* En-tête */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Bonjour, {displayName} 👋
          </h1>
          <p className="text-gray-500 mt-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </header>

      {/* Statistiques */}
      <div className="grid gap-4 md:grid-cols-3">
        {isPatient ? (
          <>
            <StatCard label="RDV à venir" value={stats.upcoming_appointments} icon="📅" bgIcon="bg-blue-50" textIcon="text-blue-600" subtext="Prochainement" />
            <StatCard label="Documents médicaux" value={stats.medical_records} icon="📋" bgIcon="bg-indigo-50" textIcon="text-indigo-600" subtext="Dossiers complets" />
            <StatCard label="Résultats d'analyses" value={stats.lab_results} icon="🧪" bgIcon="bg-purple-50" textIcon="text-purple-600" subtext="Derniers bilans" />
          </>
        ) : (
          <>
            <StatCard label="RDV aujourd'hui" value={stats.today_appointments} icon="📅" bgIcon="bg-blue-50" textIcon="text-blue-600" subtext="Consultations du jour" />
            <StatCard label="En attente" value={stats.pending_appointments} icon="⏳" bgIcon="bg-yellow-50" textIcon="text-yellow-600" subtext="À confirmer" />
            <StatCard label="Patients suivis" value={stats.total_patients} icon="👥" bgIcon="bg-green-50" textIcon="text-green-600" subtext="Patientèle active" />
          </>
        )}
      </div>

      {/* Liste des rendez-vous */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {isPatient ? 'Prochains rendez-vous' : 'Agenda du jour'}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {isPatient ? 'Vos consultations à venir' : 'Résumé de votre journée de travail'}
            </p>
          </div>
          <Link
            to={isPatient ? '/app/appointments' : '/app/appointments'}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:gap-2 transition-all"
          >
            Voir tout
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="p-6">
          {appointments.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📅</span>
              </div>
              <p className="text-gray-900 font-semibold text-lg">
                {isPatient ? 'Aucun rendez-vous à venir.' : 'Aucun rendez-vous prévu aujourd’hui.'}
              </p>
              <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
                {isPatient
                  ? 'Profitez de ce temps libre ou prenez un nouveau rendez-vous.'
                  : "C'est le moment idéal pour rattraper vos comptes-rendus en retard."}
              </p>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-gray-100">
              {appointments.map((a) => (
                <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 group hover:bg-gray-50 px-4 -mx-4 rounded-lg transition-colors">
                  {/* Informations du rendez-vous */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex flex-col items-center justify-center w-16 h-16 bg-blue-50 rounded-xl text-blue-600 border border-blue-100 shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Heure</span>
                      <span className="text-lg font-bold">{a.appointment_time?.slice(0, 5) || '--:--'}</span>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-base group-hover:text-blue-600 transition-colors">
                        {isPatient ? a.doctor_name : a.patient_name}
                      </p>
                      <p className="text-sm text-gray-500 flex items-center gap-2 mt-1 flex-wrap">
                        <span>{a.reason || a.type || 'Consultation'}</span>
                        {a.clinique_ville && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {a.clinique_ville}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Date et statut */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
                    <p className="text-sm font-semibold text-gray-600">
                      {a.appointment_date ? new Date(a.appointment_date).toLocaleDateString('fr-FR') : ''}
                    </p>
                    <StatusBadge status={a.status} />
                    {a.specialty && !isPatient && (
                      <p className="text-xs text-gray-500 hidden sm:block">{a.specialty}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions rapides - Patient */}
      {isPatient && (
        <div className="grid gap-6 md:grid-cols-2">
          <Link to="/app/book" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center gap-5 group">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-2xl text-white group-hover:scale-110 transition-transform">➕</div>
            <div>
              <p className="text-lg font-bold text-gray-900">Prendre un rendez-vous</p>
              <p className="text-sm text-gray-500">Consultez les disponibilités</p>
            </div>
          </Link>
          <Link to="/app/results" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex items-center gap-5 group">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-600 text-2xl text-white group-hover:scale-110 transition-transform">🧪</div>
            <div>
              <p className="text-lg font-bold text-gray-900">Mes résultats</p>
              <p className="text-sm text-gray-500">Analyses et bilans</p>
            </div>
          </Link>
        </div>
      )}

      {/* Actions rapides - Practitioner */}
      {!isPatient && !isAdmin && (
        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/app/patients" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center gap-5 group">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-2xl text-white group-hover:scale-110 transition-transform">🔍</div>
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-900">Rechercher un patient</p>
              <p className="text-sm text-gray-500">Accéder aux dossiers médicaux et historiques</p>
            </div>
          </Link>
          <Link to="/app/disponibilites" className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-yellow-200 transition-all flex items-center gap-5 group">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-yellow-500 text-2xl text-white group-hover:scale-110 transition-transform">⏰</div>
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-900">Gérer mes disponibilités</p>
              <p className="text-sm text-gray-500">Ajouter des créneaux ou signaler des absences</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
