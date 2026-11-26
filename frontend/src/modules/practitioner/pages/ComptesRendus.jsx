import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';

export default function ComptesRendus() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [form, setForm] = useState({
    patient_id: '',
    title: '',
    diagnosis: '',
    notes: '',
    record_date: new Date().toISOString().split('T')[0]
  });

  // Charger les patients et l'historique
  useEffect(() => {
    loadPatients();
    loadRecords();
  }, []);

  const loadPatients = async () => {
    try {
      const response = await api.practitioner.patients.search('');
      if (response.success) {
        setPatients(response.data || []);
      }
    } catch (err) {
      console.error("Erreur chargement patients:", err);
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const response = await api.practitioner.records.list();
      if (response.success) {
        setRecords(response.data || []);
      }
    } catch (err) {
      console.error("Erreur chargement comptes-rendus:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.patient_id || !form.title) {
      alert("Veuillez sélectionner un patient et saisir un titre.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.practitioner.patients.addRecord(form.patient_id, form);
      
      if (response.success) {
        alert("✅ Compte-rendu enregistré avec succès !");
        setForm({
          patient_id: '',
          title: '',
          diagnosis: '',
          notes: '',
          record_date: new Date().toISOString().split('T')[0]
        });
        loadRecords();
      }
    } catch (err) {
      alert("❌ Erreur lors de l'enregistrement: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer les patients
  const filteredPatients = patients.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  return (
    <div className="p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-on-surface">Comptes-rendus de consultation</h1>
        <p className="text-on-variant mt-2">Rédigez et consultez l'historique des comptes-rendus médicaux.</p>
      </header>

      {/* Formulaire de rédaction */}
      <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-on-surface">Nouveau compte-rendu</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Sélection du patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient concerné *
            </label>
            <div className="relative">
              <input
  type="text"
  placeholder="Rechercher un patient par nom ou téléphone..."
  value={searchTerm}
  onFocus={() => setShowDropdown(true)}
  onChange={(e) => {
    setSearchTerm(e.target.value);
    setForm({ ...form, patient_id: '' });
    setShowDropdown(true);
  }}
  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
/>
              {showDropdown && searchTerm && filteredPatients.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-60 overflow-auto">
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
  setForm({ ...form, patient_id: patient.id });
  setSearchTerm(patient.full_name);
  setShowDropdown(false);
}}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-on-surface">{patient.full_name}</p>
                        <p className="text-sm text-on-variant">{patient.phone}</p>
                      </div>
                      {form.patient_id === patient.id && (
                        <span className="text-primary text-sm font-medium">✓ Sélectionné</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Titre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titre du compte-rendu *
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Consultation de suivi cardiologique"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de la consultation
              </label>
              <input
                type="date"
                value={form.record_date}
                onChange={(e) => setForm({ ...form, record_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Diagnostic */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Diagnostic
            </label>
            <input
              type="text"
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              placeholder="Ex: HTA contrôlée sous traitement"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes et observations *
            </label>
            <textarea
              required
              rows="6"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Décrivez la consultation, les symptômes, le traitement prescrit, les recommandations..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 md:flex-none px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Enregistrer le compte-rendu
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setForm({
                patient_id: '',
                title: '',
                diagnosis: '',
                notes: '',
                record_date: new Date().toISOString().split('T')[0]
              })}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </form>
      </div>

      {/* Historique des comptes-rendus */}
      <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-on-surface">Historique des comptes-rendus</h2>
          </div>
          <span className="px-3 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">
            {records.length} document{records.length > 1 ? 's' : ''}
          </span>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-on-variant font-medium">Aucun compte-rendu enregistré</p>
            <p className="text-sm text-gray-400 mt-1">Les comptes-rendus que vous rédigerez apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => (
              <div key={record.id} className="border border-outline-variant rounded-xl p-5 hover:shadow-md transition-shadow bg-gray-50/50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-on-surface text-lg">{record.title}</h3>
                    <p className="text-sm text-on-variant mt-1">
                      Patient: <span className="font-medium text-gray-700">{record.patient_name}</span>
                      {' • '}
                      {new Date(record.record_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    Compte-rendu
                  </span>
                </div>
                
                {record.diagnosis && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">Diagnostic:</p>
                    <p className="text-sm text-gray-600 bg-surface p-3 rounded-lg border border-outline-variant">
                      {record.diagnosis}
                    </p>
                  </div>
                )}
                
                {record.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                    <p className="text-sm text-gray-600 bg-surface p-3 rounded-lg border border-outline-variant italic">
                      {record.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}