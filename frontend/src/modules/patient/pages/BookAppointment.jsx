
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/api/axiosConfig';

export default function BookAppointment() {
  const navigate = useNavigate();

  const [practitioners, setPractitioners] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');

  // Formulaire
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState('consultation');

  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPractitioners, setLoadingPractitioners] = useState(true);

  // Date locale au format YYYY-MM-DD
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  // Charger les médecins / praticiens
  useEffect(() => {
    const loadPractitioners = async () => {
      try {
        setLoadingPractitioners(true);

        const response = await api.patient.practitioners();

        const practitionersArray = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response?.practitioners)
                    ? response.practitioners
                    : Array.isArray(response?.data?.practitioners)
                        ? response.data.practitioners
                        : [];

        setPractitioners(practitionersArray);
      } catch (err) {
        console.error('Erreur chargement praticiens:', err);
        setMessage(
            `❌ ${err.message || 'Impossible de charger la liste des praticiens.'}`
        );
      } finally {
        setLoadingPractitioners(false);
      }
    };

    loadPractitioners();
  }, []);

  useEffect(() => {
    let result = practitioners;

    if (search.trim()) {
      result = result.filter((p) =>
          String(p.full_name || '')
              .toLowerCase()
              .includes(search.toLowerCase())
      );
    }

    if (specialty) {
      result = result.filter((p) => p.specialty === specialty);
    }

    setFiltered(result);
  }, [search, specialty, practitioners]);

  // Récupérer les spécialités uniques pour le menu déroulant
  const specialties = [
    ...new Set(practitioners.map((p) => p.specialty).filter(Boolean)),
  ];

  const selectedPractitioner = practitioners.find(
      (p) => p.id === selectedDoctor
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDoctor) {
      setMessage('❌ Veuillez choisir un praticien.');
      return;
    }

    if (!date) {
      setMessage('❌ Veuillez choisir une date.');
      return;
    }

    if (!time) {
      setMessage('❌ Veuillez choisir une heure.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await api.patient.appointments.create({
        doctor_id: parseInt(selectedDoctor, 10),
        appointment_date: date,
        appointment_time: time,
        reason,
        type: 'consultation',
      });

      setMessage(
          '✅ Rendez-vous demandé avec succès ! Redirection vers vos rendez-vous...'
      );

      setSelectedDoctor(null);
      setDate('');
      setTime('');
      setReason('');

      setTimeout(() => {
        navigate('/app/appointments');
      }, 1500);
    } catch (err) {
      console.error('Erreur création rendez-vous:', err);
      setMessage(
          `❌ ${err.message || 'Erreur lors de la création du rendez-vous.'}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-primary">
            Prendre un rendez-vous
          </h2>
          <p className="mt-1 text-sm text-on-variant">
            Trouvez un praticien et réservez votre créneau.
          </p>
        </div>

        {message && (
            <div
                className={`rounded-lg p-4 ${
                    message.includes('✅')
                        ? 'bg-success-container text-success'
                        : 'bg-error-container text-error'
                }`}
            >
              {message}
            </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* COLONNE GAUCHE : Recherche et liste des médecins */}
          <div className="space-y-4 md:col-span-2">
            <div className="card flex gap-3 p-4">
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
                  className="rounded-md border border-outline-variant bg-surface p-2 text-sm"
              >
                <option value="">Toutes les spécialités</option>
                {specialties.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {loadingPractitioners ? (
                  <div className="card py-10 text-center text-on-variant">
                    Chargement des praticiens...
                  </div>
              ) : filtered.length === 0 ? (
                  <div className="card py-10 text-center text-on-variant">
                    Aucun praticien ne correspond à votre recherche.
                  </div>
              ) : (
                  filtered.map((p) => (
                      <div
                          key={p.id}
                          onClick={() => setSelectedDoctor(p.id)}
                          className={`card cursor-pointer border-2 p-4 transition-all ${
                              selectedDoctor === p.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-transparent hover:border-outline-variant'
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-primary">
                              {p.full_name || 'Praticien'}
                            </h3>

                            <p className="text-sm text-on-variant">
                              {p.specialty || 'Spécialité non renseignée'}
                            </p>

                            {p.cliniques && p.cliniques.length > 0 && (
                                <p className="mt-1 text-xs text-on-variant">
                                  🏥 {p.cliniques.join(', ')}
                                </p>
                            )}
                          </div>

                          {selectedDoctor === p.id && (
                              <span className="text-xl text-primary">✓</span>
                          )}
                        </div>
                      </div>
                  ))
              )}
            </div>
          </div>

          {/* COLONNE DROITE : Formulaire de réservation */}
          <div className="md:col-span-1">
            <form onSubmit={handleSubmit} className="card sticky top-6 space-y-4 p-6">
              <h3 className="mb-2 border-b pb-2 text-lg font-bold">
                Détails du RDV
              </h3>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-variant">
                  Praticien sélectionné
                </label>

                <div className="rounded border border-outline-variant/30 bg-surface-low p-2 text-sm font-medium">
                  {selectedPractitioner
                      ? selectedPractitioner.full_name
                      : 'Aucun sélectionné'}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-variant">
                  Date
                </label>

                <input
                    type="date"
                    required
                    min={getLocalDate()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-md border border-outline-variant p-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-variant">
                  Heure
                </label>

                <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-md border border-outline-variant p-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-on-variant">
                  Motif optionnel
                </label>

                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows="2"
                    className="w-full rounded-md border border-outline-variant p-2 text-sm"
                    placeholder="Exemple : Consultation générale"
                />
              </div>

              <button
                  type="submit"
                  disabled={loading || !selectedDoctor}
                  className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Confirmer le rendez-vous'}
              </button>
            </form>
          </div>
        </div>
      </div>
  );
}
