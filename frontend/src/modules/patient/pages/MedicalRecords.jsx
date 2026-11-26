import { useEffect, useState } from 'react';
import { api } from '../../../shared/api/axiosConfig';

export default function MedicalRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.patient.records
      .list()
      .then(setRecords)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-10 text-center">Chargement...</div>;
  if (error) return <div className="rounded-lg bg-error-container p-4 text-error">{error}</div>;

  const handleDownloadRecord = async (id, title) => {
    try {
      const token = localStorage.getItem('medlink_token');
      const response = await fetch(`/api/patient/records/${id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Erreur de téléchargement");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'dossier'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-primary">Mon dossier médical</h2>
        <p className="mt-1 text-sm text-on-variant">Retrouvez l'historique de vos consultations et diagnostics.</p>
      </div>

      {records.length === 0 ? (
        <div className="card py-16 text-center text-on-variant">Aucun dossier médical disponible.</div>
      ) : (
        <div className="space-y-4">
          {records.map((r) => (
            <div key={r.id} className="card p-6 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-primary">{r.title}</h3>
                  <p className="text-sm text-on-variant">
                    Par {r.practitioner_name} ({r.specialty}) • {new Date(r.record_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span className="badge-info">Consultation</span>
              </div>
              <div className="pt-2 border-t border-outline-variant/30">
                <p className="text-sm"><span className="font-semibold">Diagnostic :</span> {r.diagnosis}</p>
                <p className="text-sm mt-1"><span className="font-semibold">Notes :</span> {r.notes}</p>
              </div>
              
              {/* --- AJOUT DU BOUTON ICI --- */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleDownloadRecord(r.id, r.title)}
                  className="rounded-md bg-surface-highest px-3 py-1.5 text-xs font-semibold text-secondary hover:opacity-80"
                >
                  📥 Télécharger en PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}