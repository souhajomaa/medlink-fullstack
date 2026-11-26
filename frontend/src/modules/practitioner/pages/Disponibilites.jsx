import { useState, useEffect } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';

export default function Disponibilites() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);
  
  const [form, setForm] = useState({
    clinique_id: '',
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: new Date().toISOString().split('T')[0],
    heure_debut: '08:00',
    heure_fin: '17:00',
    type: 'disponible',
    motif: ''
  });
  
  // ✅ NOUVEL ÉTAT : id du slot en cours de modification (null = mode création)
  const [editingId, setEditingId] = useState(null);
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchClinics();
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const response = await api.practitioner.disponibilites.list();
      if (response.success) setSlots(response.data);
    } catch (error) {
      console.error("Erreur chargement:", error);
      setMessage({ type: 'error', text: "Impossible de charger les disponibilités." });
    } finally {
      setLoading(false);
    }
  };

  const fetchClinics = async () => {
  try {
    setClinicsLoading(true);

    const response = await api.practitioner.clinics.list();

    if (response.success) {
      const data = response.data || [];
      setClinics(data);

      if (data.length > 0) {
        setForm((prev) => ({
          ...prev,
          clinique_id: String(data[0].id),
        }));
      }
    }
  } catch (error) {
    console.error("Erreur chargement des cliniques :", error);
    setMessage({
      type: 'error',
      text: "Impossible de charger vos cliniques.",
    });
  } finally {
    setClinicsLoading(false);
  }
};

  const resetForm = () => {
    setEditingId(null);
    setForm({
      clinique_id: '',
      date_debut: new Date().toISOString().split('T')[0],
      date_fin: new Date().toISOString().split('T')[0],
      heure_debut: '08:00',
      heure_fin: '17:00',
      type: 'disponible',
      motif: ''
    });
  };

  // ✅ NOUVELLE FONCTION : Pré-remplir le formulaire avec les données d'un slot
  const handleEdit = (slot) => {
    setEditingId(slot.id);
    setForm({
      clinique_id: String(slot.clinique_id),
      date_debut: slot.date_debut ? slot.date_debut.split('T')[0] : '',
      date_fin: slot.date_fin ? slot.date_fin.split('T')[0] : '',
      heure_debut: slot.heure_debut ? slot.heure_debut.substring(0, 5) : '08:00',
      heure_fin: slot.heure_fin ? slot.heure_fin.substring(0, 5) : '17:00',
      type: slot.type,
      motif: slot.motif || ''
    });
    setMessage({ type: '', text: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (form.date_fin < form.date_debut) {
      setMessage({ type: 'error', text: "La date de fin ne peut pas être avant la date de début." });
      return;
    }

    try {
      let response;
      if (editingId) {
        // ✅ Mode MODIFICATION
        response = await api.practitioner.disponibilites.update(editingId, form);
      } else {
        // Mode CRÉATION
        response = await api.practitioner.disponibilites.create(form);
      }

      if (response.success) {
        setMessage({ 
          type: 'success', 
          text: editingId ? 'Période modifiée avec succès !' : 'Période ajoutée avec succès !' 
        });
        resetForm();
        fetchSlots();
      } else {
        setMessage({ type: 'error', text: response.message || "Erreur." });
      }
    } catch (error) {
      setMessage({ type: 'error', text: "Erreur réseau lors de l'opération." });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce créneau ?")) return;
    try {
      setDeletingId(id);
      const response = await api.practitioner.disponibilites.remove(id);
      if (response.success) {
        setMessage({ type: 'success', text: 'Créneau supprimé.' });
        if (editingId === id) resetForm();
        fetchSlots();
      }
    } catch (error) {
      setMessage({ type: 'error', text: "Erreur lors de la suppression." });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="p-6 text-on-variant flex items-center justify-center h-64">Chargement des données...</div>;

  return (
    <div className="space-y-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-on-surface">Gestion de mes disponibilités</h1>
        <p className="text-on-variant">Définissez vos plages horaires de consultation ou signalez vos absences.</p>
      </header>

      {/* Formulaire (création OU modification) */}
      <div className={`rounded-xl border p-6 shadow-sm ${editingId ? 'bg-amber-50 border-amber-300' : 'bg-surface border-outline-variant'}`}>
        <h2 className="text-lg font-semibold text-on-surface mb-4">
          {editingId ? '✏️ Modifier la période' : 'Ajouter une période'}
        </h2>
        
        {message.text && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinique</label>
            <select
  required
  disabled={clinicsLoading || clinics.length === 0 || editingId !== null}
  className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
  value={form.clinique_id}
  onChange={(e) =>
    setForm({ ...form, clinique_id: e.target.value })
  }
>
  <option value="">
    {clinicsLoading ? "Chargement..." : "Sélectionner une clinique"}
  </option>

  {clinics.map((clinic) => (
    <option key={clinic.id} value={String(clinic.id)}>
      {clinic.nom} ({clinic.ville})
    </option>
  ))}
</select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select 
              required
              className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="disponible">🟢 Disponible</option>
              <option value="absence">🔴 Absence / Congé</option>
              <option value="bloque">🟠 Créneau bloqué</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
            <input 
              type="date" required
              className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              value={form.date_debut}
              onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
            <input 
              type="date" required
              className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              value={form.date_fin}
              onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heure début</label>
            <input 
              type="time" required
              className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              value={form.heure_debut}
              onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
            <input 
              type="time" required
              className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              value={form.heure_fin}
              onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
            />
          </div>

          {form.type === 'absence' && (
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif de l'absence</label>
              <input 
                type="text" required={form.type === 'absence'}
                placeholder="Ex: Congés annuels, Formation, Conférence..."
                className="w-full rounded-lg border-gray-300 border p-2.5 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
                value={form.motif}
                onChange={(e) => setForm({ ...form, motif: e.target.value })}
              />
            </div>
          )}

          <div className="md:col-span-2 lg:col-span-3 mt-2 flex gap-3">
            <button 
              type="submit" 
              className={`px-6 py-2.5 text-white font-semibold rounded-lg transition-colors shadow-sm ${
                editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {editingId ? '💾 Enregistrer les modifications' : '+ Ajouter cette période'}
            </button>
            
            {editingId && (
              <button 
                type="button" 
                onClick={resetForm}
                className="px-6 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Liste des périodes */}
      <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden">
        <div className="p-6 border-b border-outline-variant flex justify-between items-center">
          <h2 className="text-lg font-semibold text-on-surface">Historique de mes périodes</h2>
          <span className="text-sm text-on-variant">{slots.length} période{slots.length > 1 ? 's' : ''} enregistrée(s)</span>
        </div>
        
        {slots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Clinique</th>
                  <th className="px-6 py-3">Période</th>
                  <th className="px-6 py-3">Horaires</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Motif</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {slots.map((slot) => (
                  <tr key={slot.id} className={`transition-colors ${editingId === slot.id ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 font-medium text-on-surface">
                      {slot.clinique_nom || slot.clinic_name || slot.clinique?.nom || `Clinique (ID: ${slot.clinique_id})`}
                      <span className="text-on-variant text-xs">
                        ({slot.clinique_ville || slot.clinic_city || slot.clinique?.ville || '?'})
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                      {new Date(slot.date_debut).toLocaleDateString('fr-FR')} 
                      {slot.date_fin !== slot.date_debut && ` au ${new Date(slot.date_fin).toLocaleDateString('fr-FR')}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {slot.heure_debut?.substring(0, 5)} - {slot.heure_fin?.substring(0, 5)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        slot.type === 'disponible' ? 'bg-emerald-50 text-emerald-700' :
                        slot.type === 'absence' ? 'bg-red-50 text-red-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {slot.type === 'disponible' ? 'Disponible' : slot.type === 'absence' ? 'Absence' : 'Bloqué'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-on-variant italic max-w-xs truncate" title={slot.motif}>
                      {slot.motif || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* ✅ NOUVEAU BOUTON : Modifier */}
                        <button 
                          onClick={() => handleEdit(slot)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                          title="Modifier ce créneau"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        
                        {/* Bouton Supprimer */}
                        <button 
                          onClick={() => handleDelete(slot.id)}
                          disabled={deletingId === slot.id}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors disabled:opacity-50"
                          title="Supprimer ce créneau"
                        >
                          {deletingId === slot.id ? (
                            <span className="animate-spin inline-block w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full"></span>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-on-variant">
            <p className="font-medium">Aucune période définie pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}