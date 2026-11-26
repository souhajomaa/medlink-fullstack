import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';

export default function Patients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filtres et tri
  const [filterActivity, setFilterActivity] = useState('all'); // all, active, inactive
  const [sortBy, setSortBy] = useState('last_appointment'); // last_appointment, name, total_appointments
  const [viewMode, setViewMode] = useState('list'); // list, grid

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchPatients = async (search) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.practitioner.patients.search(search);
      
      console.log('PATIENTS API RESPONSE:', response);
      console.log('PATIENTS DATA:', response.data);

      if (response.success) {
        setPatients(response.data || []);
      } else {
        setError(response.error || 'Erreur inconnue');
      }
    } catch (err) {
      console.error('Erreur recherche patients:', err);
      setError('Impossible de charger les patients.');
    } finally {
      setLoading(false);
    }
  };

  // const handleViewDossier = (patientId, patientName) => {
  //   navigate(`/app/dossiers/${patientId}`, { state: { patientName } });
  // };

  const handleViewDossier = (patientId, patientName) => {
  navigate(`/app/records/${patientId}`, { state: { patientName } });
};

  // Filtrage et tri
  const filteredAndSortedPatients = patients
    .filter(patient => {
      if (filterActivity === 'active') {
        const lastAppt = new Date(patient.last_appointment);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return lastAppt >= thirtyDaysAgo;
      } else if (filterActivity === 'inactive') {
        const lastAppt = new Date(patient.last_appointment);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return lastAppt < thirtyDaysAgo;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.full_name.localeCompare(b.full_name);
      } else if (sortBy === 'total_appointments') {
        return (b.total_appointments || 0) - (a.total_appointments || 0);
      } else {
        // last_appointment
        return new Date(b.last_appointment || 0) - new Date(a.last_appointment || 0);
      }
    });

  // Statistiques
  const stats = {
    total: patients.length,
    active: patients.filter(p => {
      const lastAppt = new Date(p.last_appointment);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastAppt >= thirtyDaysAgo;
    }).length,
    inactive: patients.filter(p => {
      const lastAppt = new Date(p.last_appointment);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastAppt < thirtyDaysAgo;
    }).length,
    totalConsultations: patients.reduce((sum, p) => sum + (p.total_appointments || 0), 0),
  };

  // Déterminer si un patient est "actif" (RDV dans les 30 derniers jours)
  const isPatientActive = (patient) => {
    if (!patient.last_appointment) return false;
    const lastAppt = new Date(patient.last_appointment);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastAppt >= thirtyDaysAgo;
  };

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <header>
        <h1 className="text-3xl font-bold text-on-surface">Mes patients</h1>
        <p className="text-on-variant mt-2">
          Recherche parmi les patients que vous avez reçus en consultation
        </p>
      </header>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{stats.total}</p>
              <p className="text-xs text-on-variant">Total patients</p>
            </div>
          </div>
        </div>
        
        <div className="bg-surface p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{stats.active}</p>
              <p className="text-xs text-on-variant">Actifs (30j)</p>
            </div>
          </div>
        </div>
        
        <div className="bg-surface p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{stats.inactive}</p>
              <p className="text-xs text-on-variant">Inactifs</p>
            </div>
          </div>
        </div>
        
        <div className="bg-surface p-4 rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-on-surface">{stats.totalConsultations}</p>
              <p className="text-xs text-on-variant">Consultations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="bg-surface rounded-xl border border-outline-variant p-6 shadow-sm">
        <div className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
          />
          {loading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500"></div>
            </div>
          )}
        </div>
        <p className="text-sm text-on-variant mt-2">
          💡 Tapez au moins 1 caractère pour lancer la recherche
        </p>
      </div>

      {/* Filtres et contrôles */}
      <div className="bg-surface rounded-xl border border-outline-variant p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            {/* Filtre par activité */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Activité</label>
              <select
                value={filterActivity}
                onChange={(e) => setFilterActivity(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="all">Tous les patients</option>
                <option value="active">Actifs (30 derniers jours)</option>
                <option value="inactive">Inactifs (+30 jours)</option>
              </select>
            </div>

            {/* Tri */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Trier par</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="last_appointment">Dernier RDV</option>
                <option value="name">Nom (A-Z)</option>
                <option value="total_appointments">Nb. consultations</option>
              </select>
            </div>
          </div>

          {/* Mode d'affichage */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Affichage :</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-surface text-primary shadow-sm' : 'text-gray-600 hover:text-on-surface'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid' ? 'bg-surface text-primary shadow-sm' : 'text-gray-600 hover:text-on-surface'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Récapitulatif */}
        <div className="mt-4 pt-4 border-t border-outline-variant flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {filteredAndSortedPatients.length} patient{filteredAndSortedPatients.length > 1 ? 's' : ''} trouvé{filteredAndSortedPatients.length > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-on-variant flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Accès restreint à votre patientèle
          </span>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-3">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Liste des patients */}
      {filteredAndSortedPatients.length === 0 ? (
        <div className="bg-surface rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-on-surface font-medium text-lg">
            {searchTerm ? 'Aucun patient ne correspond à votre recherche.' : 'Aucun patient trouvé.'}
          </p>
          <p className="text-on-variant text-sm mt-1">
            Les patients apparaissent ici après leur première consultation avec vous.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        // Vue Liste
        <div className="space-y-3">
          {filteredAndSortedPatients.map((patient) => {
            const active = isPatientActive(patient);
            return (
              <div 
                key={patient.id} 
                className="bg-surface rounded-xl border border-outline-variant p-5 hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Informations patient */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-100 to-blue-100 flex items-center justify-center text-teal-700 font-bold text-xl border-2 border-white shadow-sm">
                        {patient.full_name?.charAt(0) || 'P'}
                      </div>
                      {active && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-on-surface text-lg">{patient.full_name}</p>
                        {active && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                            Actif
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-on-variant">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {patient.phone || 'Non renseigné'}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {patient.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Dernier RDV : {patient.last_appointment 
                            ? new Date(patient.last_appointment).toLocaleDateString('fr-FR')
                            : 'Aucun'}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          {patient.total_appointments || 0} consultation{patient.total_appointments > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bouton Voir le dossier */}
                  <button
                    onClick={() => handleViewDossier(patient.id, patient.full_name)}
                    className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm hover:shadow-md w-full lg:w-auto justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Voir le dossier
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Vue Grille
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedPatients.map((patient) => {
            const active = isPatientActive(patient);
            return (
              <div 
                key={patient.id} 
                className="bg-surface rounded-xl border border-outline-variant p-5 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-100 to-blue-100 flex items-center justify-center text-teal-700 font-bold text-2xl border-2 border-white shadow-sm">
                      {patient.full_name?.charAt(0) || 'P'}
                    </div>
                    {active && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  {active && (
                    <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
                      Actif
                    </span>
                  )}
                </div>
                
                <h3 className="font-bold text-on-surface text-lg mb-2">{patient.full_name}</h3>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {patient.phone || 'Non renseigné'}
                  </p>
                  <p className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{patient.email}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-on-variant mb-4">
                  <div>
                    <p className="font-medium text-gray-700">{patient.total_appointments || 0}</p>
                    <p>Consultations</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-700">
                      {patient.last_appointment 
                        ? new Date(patient.last_appointment).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                        : 'N/A'}
                    </p>
                    <p>Dernier RDV</p>
                  </div>
                </div>

                <button
                  onClick={() => handleViewDossier(patient.id, patient.full_name)}
                  className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Voir le dossier
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}