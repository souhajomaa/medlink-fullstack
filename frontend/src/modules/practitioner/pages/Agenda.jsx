import { useState, useEffect } from 'react';
import { api } from '../../../shared/api/axiosConfig';

console.log("🚀 NOUVEAU CODE AGENDA MULTI-SITES CHARGÉ AVEC SUCCÈS !");

export default function Agenda() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtres (US-19 multi-sites)
  const [cliniqueFilter, setCliniqueFilter] = useState('all');
  const [periodeFilter, setPeriodeFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');

  useEffect(() => {
    fetchAgenda();
  }, []);

  const fetchAgenda = async () => {
    try {
      setLoading(true);
      const response = await api.practitioner.appointments.list();
      const data = Array.isArray(response) ? response : (response.data || []);
      setAppointments(data);
    } catch (err) {
      console.error('Erreur chargement agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  // US-20 : changer le statut d'un RDV
  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.practitioner.appointments.updateStatus(id, newStatus);
      setAppointments(prev =>
        prev.map(a => (a.id === id ? { ...a, status: newStatus } : a))
      );
    } catch (err) {
      alert('Erreur lors de la mise à jour du statut.');
    }
  };

  // Liste unique des cliniques (dérivée des RDV)
  const cliniques = Array.from(
    new Map(
      appointments
        .filter(a => a.clinique_nom)
        .map(a => [a.clinique_id, { nom: a.clinique_nom, ville: a.clinique_ville }])
    ).values()
  );

  // Application des filtres
  const filtered = appointments.filter(a => {
    if (cliniqueFilter !== 'all' && String(a.clinique_id) !== String(cliniqueFilter)) return false;
    if (statutFilter !== 'all' && a.status !== statutFilter) return false;
    if (periodeFilter !== 'all') {
      const d = new Date(a.appointment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (periodeFilter === 'today' && d.toDateString() !== today.toDateString()) return false;
      if (periodeFilter === 'week') {
        const limit = new Date(today);
        limit.setDate(today.getDate() + 7);
        if (d < today || d > limit) return false;
      }
    }
    return true;
  });

  // Statistiques GLOBALES (vue d'ensemble, indépendantes des filtres)
  const stats = {
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
  };

  // Regroupement par date
  const grouped = filtered.reduce((acc, a) => {
    const date = new Date(a.appointment_date).toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    (acc[date] = acc[date] || []).push(a);
    return acc;
  }, {});

  const resetFilters = () => {
    setCliniqueFilter('all');
    setPeriodeFilter('all');
    setStatutFilter('all');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-on-surface">Agenda médical multi-sites</h1>
        <p className="text-on-variant">Gérez les consultations de vos patients.</p>
      </header>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="📅" label="Total" value={stats.total} bg="bg-blue-50" />
        <StatCard icon="⏳" label="En attente" value={stats.pending} bg="bg-yellow-50" />
        <StatCard icon="✅" label="Confirmés" value={stats.confirmed} bg="bg-emerald-50" />
        <StatCard icon="📋" label="Terminés" value={stats.completed} bg="bg-indigo-50" />
      </div>

      {/* Filtres multi-sites */}
      <div className="bg-surface rounded-xl border border-outline-variant p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <FilterSelect label="Clinique" value={cliniqueFilter} onChange={setCliniqueFilter}>
          <option value="all">Toutes les cliniques</option>
          {cliniques.map(c => (
            <option key={c.nom} value={appointments.find(a => a.clinique_nom === c.nom)?.clinique_id}>
              {c.nom} ({c.ville})
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Période" value={periodeFilter} onChange={setPeriodeFilter}>
          <option value="all">Toutes les dates</option>
          <option value="today">Aujourd'hui</option>
          <option value="week">7 prochains jours</option>
        </FilterSelect>
        <FilterSelect label="Statut" value={statutFilter} onChange={setStatutFilter}>
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="confirmed">Confirmés</option>
          <option value="completed">Terminés</option>
          <option value="cancelled">Annulés</option>
        </FilterSelect>
      </div>

      <div className="flex items-center justify-between text-sm text-on-variant">
        <span>{filtered.length} rendez-vous trouvé{filtered.length > 1 ? 's' : ''}</span>
        <button onClick={resetFilters} className="text-teal-600 hover:underline">
          Réinitialiser les filtres
        </button>
      </div>

      {/* Liste groupée par jour */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-xl border border-outline-variant">
          <p className="text-on-variant text-lg">📅 Aucun rendez-vous trouvé pour ce filtre.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, dayAppts]) => (
            <div key={date}>
              <h2 className="text-lg font-semibold capitalize flex items-center gap-2 border-b border-outline-variant pb-2">
                📅 {date}
                <span className="text-sm font-normal bg-gray-100 px-2 py-0.5 rounded-full">
                  {dayAppts.length} RDV
                </span>
              </h2>

              <div className="space-y-3 mt-3">
                {dayAppts.map(appt => (
                  <div
                    key={appt.id}
                    className="bg-surface rounded-xl border border-outline-variant p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-shadow"
                  >
                    {/* Infos */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex flex-col items-center justify-center w-16 h-16 bg-teal-50 rounded-lg text-teal-700 shrink-0">
                        <span className="text-xs font-medium uppercase">Heure</span>
                        <span className="text-lg font-bold">{appt.appointment_time?.slice(0, 5)}</span>
                      </div>
                      <div>
                        <p className="font-bold text-on-surface text-lg">{appt.patient_name}</p>
                        <p className="text-sm text-on-variant flex items-center gap-2 mt-1 flex-wrap">
                          <span>{appt.reason || appt.type || 'Consultation'}</span>
                          <span className="text-gray-300">•</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                            📍 {appt.clinique_ville} — {appt.clinique_nom}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Statut + Actions : UNE SEULE FOIS */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        appt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                        appt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        appt.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {appt.status === 'confirmed' ? 'Confirmé' :
                         appt.status === 'pending' ? 'En attente' :
                         appt.status === 'completed' ? 'Terminé' : 'Annulé'}
                      </span>

                      {appt.status === 'pending' && (
                        <button onClick={() => handleStatusChange(appt.id, 'confirmed')}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700">
                          ✓ Confirmer
                        </button>
                      )}
                      {appt.status === 'confirmed' && (
                        <button onClick={() => handleStatusChange(appt.id, 'completed')}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                          ✓ Terminer
                        </button>
                      )}
                      {(appt.status === 'pending' || appt.status === 'confirmed') && (
                        <button onClick={() => handleStatusChange(appt.id, 'cancelled')}
                          className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 border border-red-200">
                          ✕ Annuler
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Sous-composants locaux --- */
function StatCard({ icon, label, value, bg }) {
  return (
    <div className={`${bg} rounded-xl border border-outline-variant p-4 flex items-center gap-3`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-on-surface">{value ?? 0}</p>
        <p className="text-xs text-on-variant">{label}</p>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 p-2.5 bg-white focus:ring-2 focus:ring-teal-500"
      >
        {children}
      </select>
    </div>
  );
}