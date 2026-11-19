import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';

export default function BookAppointment() {
  const [practitioners, setPractitioners] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  
  // Formulaire
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Charger les médecins
  useEffect(() => {
    api.patient.practitioners().then(setPractitioners).catch(console.error);
  }, []);

  // Appliquer les filtres
  useEffect(() => {
    let result = practitioners;
    if (search) {
      result = result.filter(p => p.full_name.toLowerCase().includes(search.toLowerCase()));
    }
    if (specialty) {
      result = result.filter(p => p.specialty === specialty);
    }
    setFiltered(result);
  }, [search, specialty, practitioners]);

  // Récupérer les spécialités uniques pour le menu déroulant
  const specialties = [...new Set(practitioners.map(p => p.specialty).filter(Boolean))];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDoctor) return setMessage('Veuillez choisir un praticien.');
    
    setLoading(true);
    setMessage('');
    try {
      await api.patient.appointments.create({
        doctor_id: selectedDoctor,
        appointment_date: date,
        appointment_time: time,
        reason,
        type: 'consultation'
      });
      setMessage('✅ Rendez-vous demandé avec succès ! (En attente de confirmation)');
      setSelectedDoctor(null);
      setDate('');
      setTime('');
      setReason('');
      setSuccess(true);
      setTimeout(() => navigate('/app/appointments'), 1500);
    } catch (err) {
      setMessage('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-primary">Prendre un rendez-vous</h2>
        <p className="mt-1 text-sm text-on-variant">Trouvez un praticien et réservez votre créneau.</p>
      </div>

      {message && (
        <div className={`rounded-lg p-4 ${message.includes('✅') ? 'bg-success-container text-success' : 'bg-error-container text-error'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLONNE GAUCHE : Recherche et liste des médecins */}
        <div className="md:col-span-2 space-y-4">
          <div className="card p-4 flex gap-3">
            <input 
              type="text" 
              placeholder="Rechercher un nom..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-md border border-outline-variant p-2 text-sm"
            />
            <select 
              value={specialty} 
              onChange={(e) => setSpecialty(e.target.value)}
              className="rounded-md border border-outline-variant p-2 text-sm bg-surface"
            >
              <option value="">Toutes les spécialités</option>
              {specialties.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="card py-10 text-center text-on-variant">Aucun praticien ne correspond à votre recherche.</div>
            ) : (
              filtered.map((p) => (
                <div 
                  key={p.id} 
                  onClick={() => setSelectedDoctor(p.id)}
                  className={`card p-4 cursor-pointer transition-all border-2 ${selectedDoctor === p.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-outline-variant'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-primary">{p.full_name}</h3>
                      <p className="text-sm text-on-variant">{p.specialty}</p>
                      {p.cliniques && p.cliniques.length > 0 && (
                        <p className="text-xs text-on-variant mt-1">🏥 {p.cliniques.join(', ')}</p>
                      )}
                    </div>
                    {selectedDoctor === p.id && <span className="text-primary text-xl">✓</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLONNE DROITE : Formulaire de réservation */}
        <div className="md:col-span-1">
          <form onSubmit={handleSubmit} className="card p-6 space-y-4 sticky top-6">
            <h3 className="font-bold text-lg border-b pb-2 mb-2">Détails du RDV</h3>
            
            <div>
              <label className="block text-xs font-semibold text-on-variant mb-1">Praticien sélectionné</label>
              <div className="text-sm font-medium p-2 bg-surface-low rounded border border-outline-variant/30">
                {selectedDoctor ? filtered.find(p => p.id === selectedDoctor)?.full_name : 'Aucun sélectionné'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-variant mb-1">Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-outline-variant p-2 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-variant mb-1">Heure</label>
              <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md border border-outline-variant p-2 text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-variant mb-1">Motif (optionnel)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows="2" className="w-full rounded-md border border-outline-variant p-2 text-sm"></textarea>
            </div>

            <button type="submit" disabled={loading || !selectedDoctor} className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading ? 'Envoi...' : 'Confirmer le rendez-vous'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}