import { useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';

export default function Profile() {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [consent, setConsent] = useState(user?.consent_given || false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await api.patient.updateProfile({ phone, consent_given: consent });
      setMessage('✅ Profil mis à jour avec succès !');
    } catch (err) {
      setMessage('❌ Erreur : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-primary">Mon Profil</h2>
        <p className="mt-1 text-sm text-on-variant">Gérez vos informations personnelles et vos consentements.</p>
      </div>

      {message && (
        <div className={`rounded-lg p-4 ${message.includes('✅') ? 'bg-success-container text-success' : 'bg-error-container text-error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        <div>
          <label className="block text-sm font-semibold text-on-variant mb-1">Email (non modifiable)</label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full rounded-md border border-outline-variant/50 bg-surface-low p-2.5 text-on-variant cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-on-variant mb-1">Numéro de téléphone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+216 ..."
            className="w-full rounded-md border border-outline-variant p-2.5 focus:border-primary focus:outline-none"
          />
        </div>

        <div className="rounded-lg border border-outline-variant/50 bg-surface-low p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <label htmlFor="consent" className="text-sm text-on-variant leading-relaxed">
              <span className="font-semibold text-primary block mb-1">Consentement INPDP</span>
              J'accepte que mes données médicales et personnelles soient collectées et traitées par MedLink, conformément à la loi tunisienne sur la protection des données personnelles (INPDP).
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </div>
  );
}
