
import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';

export default function BookAppointment() {
  const [practitioners, setPractitioners] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState('consultation');

  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.patient.practitioners()
      .then(setPractitioners)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let result = practitioners;

    if (search) {
      result = result.filter((p) =>
        p.full_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (specialty) {
      result = result.filter((p) => p.specialty === specialty);
    }

    setFiltered(result);
  }, [search, specialty, practitioners]);

  const specialties = [
    ...new Set(practitioners.map((p) => p.specialty).filter(Boolean)),
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDoctor) {
      setMessage({
        type: 'error',
        text: 'Veuillez choisir un praticien.',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await api.patient.appointments.create({
        doctor_id: parseInt(selectedDoctor, 10),
        appointment_date: date,
        appointment_time: time,
        reason,
        type,
      });

      setMessage({
        type: 'success',
        text: 'Rendez-vous demandé avec succès ! En attente de confirmation.',
      });

      setSelectedDoctor(null);
      setDate('');
      setTime('');
      setReason('');
      setType('consultation');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Une erreur est survenue.',
      });
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

      {error && (
        <div className="rounded-lg bg-error-container px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-success-container text-success'
              : 'bg-error-container text-error'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Recherche et liste des praticiens */}
        <div className="space-y-4 md:col-span-2">
          <div className="card flex flex-col gap-3 p-4 sm:flex-row">
            <input
              type="text"
              placeholder="Rechercher un praticien..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input flex-1"
            />

            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="input sm:max-w-xs"
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
            {filtered.length === 0 ? (
              <div className="card py-10 text-center text-on-variant">
                Aucun praticien ne correspond à votre recherche.
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setSelectedDoctor(p.id);
                    setMessage(null);
                  }}
                  className={`card w-full cursor-pointer border-2 p-4 text-left transition-all ${
                    selectedDoctor === p.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:border-outline-variant'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-primary">
                        {p.full_name}
                      </h3>
                      <p className="text-sm text-on-variant">
                        {p.specialty}
                      </p>

                      {p.cliniques?.length > 0 && (
                        <p className="mt-1 text-xs text-on-variant">
                          🏥 {p.cliniques.join(', ')}
                        </p>
                      )}
                    </div>

                    {selectedDoctor === p.id && (
                      <span className="text-xl text-primary">✓</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Formulaire de réservation */}
        <div className="md:col-span-1">
          <form
            onSubmit={handleSubmit}
            className="card sticky top-6 space-y-4 p-6"
          >
            <h3 className="mb-2 border-b pb-2 text-lg font-bold">
              Détails du rendez-vous
            </h3>

            <div>
              <label className="mb-1 block text-xs font-semibold text-on-variant">
                Praticien sélectionné
              </label>
              <div className="rounded border border-outline-variant/30 bg-surface-low p-2 text-sm font-medium">
                {practitioners.find((p) => p.id === selectedDoctor)
                  ?.full_name || 'Aucun praticien sélectionné'}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="appointment_date">
                Date
              </label>
              <input
                id="appointment_date"
                type="date"
                required
                min={minDateStr}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input w-full"
              />
            </div>

            <div>
              <label className="label" htmlFor="appointment_time">
                Heure
              </label>
              <select
                id="appointment_time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input w-full"
              >
                <option value="">Choisir un créneau</option>
                {[
                  '08:00', '08:30', '09:00', '09:30',
                  '10:00', '10:30', '11:00', '11:30',
                  '14:00', '14:30', '15:00', '15:30',
                  '16:00', '16:30', '17:00',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="appointment_type">
                Type de consultation
              </label>
              <select
                id="appointment_type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input w-full"
              >
                <option value="consultation">Consultation</option>
                <option value="suivi">Suivi</option>
                <option value="urgence">Urgence</option>
                <option value="teleconsultation">Téléconsultation</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="appointment_reason">
                Motif (optionnel)
              </label>
              <textarea
                id="appointment_reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="input w-full resize-y"
                placeholder="Décrivez brièvement le motif..."
              />
            </div>

            <button
              type="submit"
              disabled={loading || !selectedDoctor}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Envoi...' : 'Confirmer le rendez-vous'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
