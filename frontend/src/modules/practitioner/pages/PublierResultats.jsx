import { useState, useEffect } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';

export default function PublierResultats() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dragActive, setDragActive] = useState(false);
  
  // ✅ NOUVEAU : État pour savoir si le champ est cliqué
  const [isFocused, setIsFocused] = useState(false);
  
  const [form, setForm] = useState({
    patient_id: '',
    test_name: '',
    result_value: '',
    unit: '',
    reference_range: '',
    status: 'normal',
    result_date: new Date().toISOString().split('T')[0]
  });
  const [file, setFile] = useState(null);

  useEffect(() => {
    loadPatients();
    loadResults();
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

  const loadResults = async () => {
  try {
    setLoading(true);

    const response = await api.practitioner.results.list();

    if (response.success) {
      setResults(response.data || []);
    } else {
      setResults([]);
    }
  } catch (err) {
    console.error("Erreur chargement résultats:", err);
    setResults([]);
  } finally {
    setLoading(false);
  }
};

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.patient_id || !form.test_name) {
      alert("Veuillez sélectionner un patient et saisir le nom de l'examen.");
      return;
    }

    try {
      setLoading(true);
      const response = await api.practitioner.patients.addResult(form.patient_id, form);
      
      if (response.success) {
        alert("✅ Résultat publié avec succès !");
        setForm({
          patient_id: '',
          test_name: '',
          result_value: '',
          unit: '',
          reference_range: '',
          status: 'normal',
          result_date: new Date().toISOString().split('T')[0]
        });
        setFile(null);
        setSearchTerm('');
        loadResults();
      }
    } catch (err) {
      alert("❌ Erreur lors de la publication: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm)
  );

  return (
    <div className="p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-on-surface">Publier des résultats d'examens</h1>
        <p className="text-on-variant mt-2">Ajoutez des résultats d'analyses et d'examens au dossier des patients.</p>
      </header>

      <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-on-surface">Nouveau résultat d'examen</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* ✅ SÉLECTION DU PATIENT AMÉLIORÉE */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient concerné *
            </label>
            <input
              type="text"
              placeholder={form.patient_id ? "Patient sélectionné" : "Cliquez pour choisir ou tapez pour rechercher..."}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setForm({ ...form, patient_id: '' }); // Réinitialise la sélection si on modifie le texte
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)} // Délai pour laisser le clic s'exécuter
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors ${
                form.patient_id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300'
              }`}
            />
            
            {/* Dropdown qui s'affiche au focus OU à la frappe */}
            {isFocused && filteredPatients.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-surface border border-outline-variant rounded-lg shadow-xl max-h-60 overflow-auto">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()} // Empêche le onBlur de cacher la liste avant le clic
                    onClick={() => {
                      setForm({ ...form, patient_id: patient.id });
                      setSearchTerm(patient.full_name);
                      setIsFocused(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-amber-50 flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors ${
                      form.patient_id === patient.id ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                        {patient.full_name?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <p className="font-medium text-on-surface">{patient.full_name}</p>
                        <p className="text-xs text-on-variant">{patient.phone} • {patient.email}</p>
                      </div>
                    </div>
                    {form.patient_id === patient.id && (
                      <span className="text-amber-600 text-sm font-bold">✓ Sélectionné</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Message si la recherche ne donne rien */}
            {isFocused && filteredPatients.length === 0 && searchTerm && (
              <div className="absolute z-20 w-full mt-1 bg-surface border border-outline-variant rounded-lg shadow-lg p-4 text-center text-on-variant text-sm">
                Aucun patient ne correspond à "{searchTerm}"
              </div>
            )}

            {/* Indicateur de succès sous le champ */}
            {form.patient_id && (
              <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Patient sélectionné avec succès (ID: {form.patient_id})
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l'examen *</label>
              <input
                type="text"
                required
                value={form.test_name}
                onChange={(e) => setForm({ ...form, test_name: e.target.value })}
                placeholder="Ex: Hémoglobine glyquée (HbA1c), Cholestérol total..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Valeur du résultat *</label>
              <input
                type="text"
                required
                value={form.result_value}
                onChange={(e) => setForm({ ...form, result_value: e.target.value })}
                placeholder="Ex: 6.8"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unité</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="Ex: g/L, %, ng/mL"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Valeurs de référence</label>
              <input
                type="text"
                value={form.reference_range}
                onChange={(e) => setForm({ ...form, reference_range: e.target.value })}
                placeholder="Ex: 4.0 - 5.6 %"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Statut du résultat *</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-surface"
              >
                <option value="normal">✓ Normal</option>
                <option value="abnormal">⚠️ Anormal</option>
                <option value="critical">🚨 Critique</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de l'examen</label>
              <input
                type="date"
                value={form.result_date}
                onChange={(e) => setForm({ ...form, result_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fichier PDF (optionnel)</label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-left">
                    <p className="font-medium text-on-surface">{file.name}</p>
                    <p className="text-sm text-on-variant">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="ml-4 text-red-600 hover:text-red-700 font-bold"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div>
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 font-medium">Glissez-déposez un fichier ici, ou <span className="text-amber-600 font-semibold">parcourez</span></p>
                  <p className="text-sm text-on-variant mt-1">PDF, JPG ou PNG (max. 10 MB)</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 md:flex-none px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Publication...</>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Publier le résultat
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({ patient_id: '', test_name: '', result_value: '', unit: '', reference_range: '', status: 'normal', result_date: new Date().toISOString().split('T')[0] });
                setFile(null);
                setSearchTerm('');
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </form>
      </div>

      {/* Historique des résultats */}
      <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-on-surface">Résultats publiés récemment</h2>
          </div>
          <span className="px-3 py-1 text-sm font-medium bg-gray-100 text-gray-700 rounded-full">
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </span>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-on-variant font-medium">Aucun résultat publié</p>
            <p className="text-sm text-gray-400 mt-1">Les résultats que vous publierez apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <div key={result.id} className="border border-outline-variant rounded-xl p-4 hover:shadow-md transition-shadow bg-gray-50/50 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-on-surface">{result.test_name}</h3>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      result.status === 'normal' ? 'bg-emerald-100 text-emerald-700' :
                      result.status === 'abnormal' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {result.status === 'normal' ? 'Normal' : result.status === 'abnormal' ? 'Anormal' : 'Critique'}
                    </span>
                  </div>
                  <p className="text-sm text-on-variant mt-1">
                    Patient: <span className="font-medium text-gray-700">{result.patient_name}</span>
                    {' • '} Résultat: <span className="font-medium">{result.result_value} {result.unit}</span>
                    {result.reference_range && <span className="text-gray-400"> (Réf: {result.reference_range})</span>}
                  </p>
                </div>
                <div className="text-right text-sm text-on-variant">
                  {new Date(result.result_date).toLocaleDateString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}