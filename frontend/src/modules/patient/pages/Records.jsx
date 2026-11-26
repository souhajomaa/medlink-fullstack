import { useState, useEffect } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { api } from '../../../shared/api/axiosConfig';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fonction utilitaire pour formater les dates
const formatDate = (dateString) => {
  if (!dateString) return 'Date non renseignée';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Date invalide';
  return date.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
};

export default function Records() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPatient, setFilterPatient] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [expandedRecord, setExpandedRecord] = useState(null);

  useEffect(() => {
    api.records
      .list()
      .then((response) => {
        const recordsArray = Array.isArray(response) ? response : (response.data || []);
        setList(recordsArray);
      })
      .catch((err) => setError(err.message || 'Erreur de chargement des dossiers'))
      .finally(() => setLoading(false));
  }, []);

  const isDoctor = user?.role === 'practitioner';

  // Filtrer les dossiers
  const filteredRecords = list.filter(record => {
    const matchSearch = !searchTerm || 
      record.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchPatient = filterPatient === 'all' || record.patient_id?.toString() === filterPatient;
    
    let matchDate = true;
    if (filterDate !== 'all') {
      const recordDate = new Date(record.record_date);
      const today = new Date();
      const daysDiff = (today - recordDate) / (1000 * 60 * 60 * 24);
      
      if (filterDate === 'week') matchDate = daysDiff <= 7;
      else if (filterDate === 'month') matchDate = daysDiff <= 30;
      else if (filterDate === 'year') matchDate = daysDiff <= 365;
    }
    
    return matchSearch && matchPatient && matchDate;
  });

  // Statistiques
  const stats = {
    total: filteredRecords.length,
    thisWeek: filteredRecords.filter(r => {
      const daysDiff = (new Date() - new Date(r.record_date)) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7;
    }).length,
    withDiagnosis: filteredRecords.filter(r => r.diagnosis).length,
  };

  // Liste unique des patients
  const patients = [...new Set(list.map(r => r.patient_name).filter(Boolean))];

// Générer un PDF avec un ou plusieurs comptes-rendus
const generatePDF = (records, filename = 'comptes-rendus-medlink.pdf') => {
  if (!records || records.length === 0) {
    alert('Aucun compte-rendu disponible.');
    return;
  }

  const doc = new jsPDF();

  records.forEach((record, index) => {
    if (index > 0) {
      doc.addPage();
    }

    doc.setFontSize(18);
    doc.setTextColor(15, 118, 110);
    doc.text('MEDLINK - Compte-rendu médical', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);

    autoTable(doc, {
      startY: 30,
      head: [['Information', 'Détail']],
      body: [
        ['Titre', record.title || 'Compte-rendu de consultation'],
        ['Patient', record.patient_name || 'Non renseigné'],
        ['Médecin', record.doctor_name || record.practitioner_name || 'Non renseigné'],
        ['Date', formatDate(record.record_date)],
        ['Diagnostic', record.diagnosis || 'Non renseigné'],
        ['Notes', record.notes || 'Aucune note'],
      ],
      styles: {
        fontSize: 10,
        cellPadding: 4,
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 140 },
      },
      margin: { left: 14, right: 14 },
    });

    doc.setFontSize(8);
    doc.text(
      'Document généré par MedLink',
      14,
      doc.internal.pageSize.height - 10
    );
  });

  doc.save(filename);
};

// Éviter l'injection HTML dans le document imprimé
const escapeHTML = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Générer un document imprimable
const printRecords = (records, title = 'Comptes-rendus médicaux') => {
  if (!records || records.length === 0) {
    alert('Aucun compte-rendu à exporter.');
    return;
  }

  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('Autorise les fenêtres pop-up pour exporter le PDF.');
    return;
  }

  const content = records.map(record => `
    <article class="record">
      <h2>${escapeHTML(record.title || 'Compte-rendu de consultation')}</h2>

      <p><strong>Patient :</strong> ${escapeHTML(record.patient_name || 'Non renseigné')}</p>
      <p><strong>Médecin :</strong> ${escapeHTML(record.doctor_name || record.practitioner_name || 'Non renseigné')}</p>
      <p><strong>Date :</strong> ${escapeHTML(formatDate(record.record_date))}</p>

      <h3>Diagnostic</h3>
      <p>${escapeHTML(record.diagnosis || 'Aucun diagnostic renseigné')}</p>

      <h3>Notes et observations</h3>
      <p class="notes">${escapeHTML(record.notes || 'Aucune note renseignée')}</p>
    </article>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHTML(title)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 30px;
          color: #222;
        }
        h1 { color: #0f766e; }
        h2 { color: #115e59; }
        h3 { margin-top: 20px; color: #374151; }
        .record {
          padding: 20px;
          margin-bottom: 25px;
          border: 1px solid #ddd;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        .notes { white-space: pre-wrap; }
        @media print {
          body { padding: 10px; }
          .record { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>${escapeHTML(title)}</h1>
      ${content}
    </body>
    </html>
  `);

  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
};

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent mb-4" />
        <p className="text-gray-500 font-medium">Chargement des dossiers médicaux...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 m-6 bg-red-50 text-red-700 rounded-2xl border border-red-200 flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <p className="font-bold">Erreur de chargement</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* En-tête amélioré */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">
              {isDoctor ? 'Dossiers des patients' : 'Mon dossier médical'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isDoctor
                ? 'Historique complet des consultations, diagnostics et comptes-rendus.'
                : 'Vos documents, diagnostics et comptes-rendus de consultation.'}
            </p>
          </div>
        </div>
        <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm flex items-center gap-2 shadow-sm" onClick={() => generatePDF(filteredRecords, 'historique-medlink.pdf')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exporter PDF
        </button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-teal-50 to-blue-50 p-5 rounded-2xl border border-teal-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total dossiers</p>
              <p className="text-3xl font-bold text-teal-700">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Cette semaine</p>
              <p className="text-3xl font-bold text-emerald-700">{stats.thisWeek}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-5 rounded-2xl border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Avec diagnostic</p>
              <p className="text-3xl font-bold text-purple-700">{stats.withDiagnosis}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Recherche textuelle */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Patient, diagnostic, titre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Filtre par patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patient</label>
            <select
              value={filterPatient}
              onChange={(e) => setFilterPatient(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">Tous les patients</option>
              {patients.map((name, idx) => (
                <option key={idx} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Filtre par date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">Toutes les dates</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois-ci</option>
              <option value="year">Cette année</option>
            </select>
          </div>
        </div>

        {/* Récapitulatif */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600 font-medium">
            {filteredRecords.length} dossier{filteredRecords.length > 1 ? 's' : ''} trouvé{filteredRecords.length > 1 ? 's' : ''}
          </span>
          {(searchTerm || filterPatient !== 'all' || filterDate !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterPatient('all');
                setFilterDate('all');
              }}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Liste des dossiers */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold text-lg mb-1">Aucun dossier trouvé</p>
          <p className="text-gray-500 text-sm">
            {list.length === 0 
              ? "Les dossiers médicaux apparaîtront ici après vos consultations." 
              : "Aucun dossier ne correspond à vos critères de recherche."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((record) => (
            <div 
              key={record.id} 
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300"
            >
              {/* En-tête du dossier */}
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-100 to-blue-100 flex items-center justify-center text-teal-700 font-bold text-lg border-2 border-white shadow-sm">
                      {(isDoctor ? record.patient_name : (record.doctor_name || record.practitioner_name))?.charAt(0) || 'M'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-gray-900">
                          {record.title || 'Compte-rendu de consultation'}
                        </h3>
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          Compte-rendu
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {isDoctor 
                            ? `Patient : ${record.patient_name || 'Inconnu'}` 
                            : `Dr. ${record.doctor_name || record.practitioner_name || 'Médecin'}`}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(record.record_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setExpandedRecord(
  expandedRecord === record.id ? null : record.id
)}
                      className="px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {expandedRecord === record.id ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                          Réduire
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          Détails
                        </>
                      )}
                    </button>
                    <button className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Contenu du dossier */}
              {expandedRecord === record.id && (
              <div className="p-6 space-y-6">
                {/* Diagnostic */}
                {record.diagnosis && (
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wide">Diagnostic</h4>
                    </div>
                    <p className="text-gray-900 font-medium leading-relaxed">{record.diagnosis}</p>
                  </div>
                )}
                
                
                {/* Notes */}
                {record.notes && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide">Notes et observations</h4>
                    </div>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{record.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
  onClick={() => printRecords([record], 'Compte-rendu médical')}
  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Imprimer
                  </button>
                  <button
  onClick={() => generatePDF([record], `compte-rendu-${record.id}.pdf`)}
  className="px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg transition-colors flex items-center gap-2"
>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Télécharger PDF
                  </button>
                </div>
              </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}