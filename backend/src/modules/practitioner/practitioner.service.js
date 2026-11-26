import pool from '../../shared/utils/db.js';
import { decrypt } from '../../shared/utils/encryption.js';

export async function listAppointments(practitionerId, cliniqueId = null) {
  const result = await pool.query(
    `SELECT
        a.id,
        a.appointment_date,
        a.appointment_time,
        a.reason,
        a.type,
        a.status,
        a.clinique_id,
        c.nom AS clinique_nom,
        c.ville AS clinique_ville,
        p.id AS patient_id,
        p.full_name AS patient_name
     FROM appointments a
     JOIN users p ON a.patient_id = p.id
     LEFT JOIN cliniques c ON a.clinique_id = c.id
     WHERE a.practitioner_id = $1
       AND (
         $2::integer IS NULL
         OR (
           a.clinique_id = $2
           AND EXISTS (
             SELECT 1
             FROM practitioner_clinique pc
             WHERE pc.practitioner_id = $1
               AND pc.clinique_id = $2
           )
         )
       )
     ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
    [practitionerId, cliniqueId]
  );

  return result.rows;
}



export async function updateAppointmentStatus(practitionerId, appointmentId, status) {
  const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];

  // 1. Vérifier le statut
  if (!allowed.includes(status)) {
    const err = new Error('Statut invalide');
    err.status = 400;
    throw err;
  }

  // 2. Vérifier que le rendez-vous existe et appartient au praticien
  const appointmentCheck = await pool.query(
    `SELECT id, patient_id, appointment_date, appointment_time
     FROM appointments
     WHERE id = $1 AND practitioner_id = $2`,
    [appointmentId, practitionerId]
  );

  if (appointmentCheck.rows.length === 0) {
    const err = new Error('Rendez-vous non trouvé ou non autorisé');
    err.status = 404;
    throw err;
  }

  const appointment = appointmentCheck.rows[0];

  // 3. Interdire de terminer un rendez-vous futur
  if (status === 'completed') {
    const dateCheck = await pool.query(
      `SELECT
         (
           $1::date + $2::time > CURRENT_TIMESTAMP
         ) AS is_future`,
      [appointment.appointment_date, appointment.appointment_time]
    );

    if (dateCheck.rows[0].is_future) {
      const err = new Error(
        'Impossible de terminer un rendez-vous avant sa date et son heure.'
      );
      err.status = 400;
      throw err;
    }
  }

  // 4. Modifier le statut
  const result = await pool.query(
    `UPDATE appointments
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND practitioner_id = $3
     RETURNING id, patient_id, status, appointment_date, appointment_time, reason, type`,
    [status, appointmentId, practitionerId]
  );

  const appt = result.rows[0];

  // 5. Créer une notification pour le patient
  if (['cancelled', 'confirmed', 'completed'].includes(status)) {
    const messages = {
      cancelled: {
        title: '🚨 Rendez-vous annulé',
        message: `Votre rendez-vous du ${new Date(appt.appointment_date).toLocaleDateString('fr-FR')} à ${appt.appointment_time?.slice(0, 5)} a été annulé par votre praticien.`
      },
      confirmed: {
        title: '✅ Rendez-vous confirmé',
        message: `Votre rendez-vous du ${new Date(appt.appointment_date).toLocaleDateString('fr-FR')} à ${appt.appointment_time?.slice(0, 5)} est confirmé.`
      },
      completed: {
        title: '📋 Consultation terminée',
        message: `Votre consultation du ${new Date(appt.appointment_date).toLocaleDateString('fr-FR')} est terminée. Un compte-rendu sera disponible prochainement.`
      }
    };

    const msg = messages[status];

    await pool.query(
      `INSERT INTO notifications (
         utilisateur_id,
         appointment_id,
         type,
         title,
         message
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        appt.patient_id,
        appointmentId,
        `appointment_${status}`,
        msg.title,
        msg.message
      ]
    );
  }

  return appt;
}


export async function listDisponibilites(practitionerId) {
  const query = `
    SELECT 
      d.id, 
      d.clinique_id, 
      d.date_debut, 
      d.date_fin, 
      d.heure_debut, 
      d.heure_fin, 
      d.type, 
      d.motif,
      c.nom AS clinique_nom,
      c.ville AS clinique_ville
    FROM disponibilites d
    LEFT JOIN cliniques c ON d.clinique_id = c.id
    WHERE d.practitioner_id = $1
    ORDER BY d.date_debut DESC, d.heure_debut ASC
  `;
  
  const result = await pool.query(query, [practitionerId]);
  return result.rows;
}

export async function updateDisponibilite(practitionerId, slotId, data) {
  const { clinique_id, date_debut, date_fin, heure_debut, heure_fin, type, motif } = data;

  // ✅ 1. Sécurité : vérifier que le slot appartient bien au praticien
  const owner = await pool.query(
    `SELECT id, practitioner_id FROM disponibilites WHERE id = $1`,
    [slotId]
  );
  if (owner.rows.length === 0) {
    const err = new Error('Créneau introuvable');
    err.status = 404;
    throw err;
  }
  if (owner.rows[0].practitioner_id !== practitionerId) {
    const err = new Error('Vous ne pouvez pas modifier ce créneau');
    err.status = 403;
    throw err;
  }

  // ✅ 2. Sécurité métier : vérifier l'affectation à la clinique
  const cliniqueCheck = await pool.query(
    `SELECT 1 FROM practitioner_clinique WHERE practitioner_id = $1 AND clinique_id = $2`,
    [practitionerId, clinique_id]
  );
  if (cliniqueCheck.rows.length === 0) {
    const err = new Error('Vous n\'êtes pas affecté à cette clinique');
    err.status = 403;
    throw err;
  }

  // ✅ 3. NOUVEAU : Vérification de chevauchement (en excluant le créneau en cours de modif)
  const overlapCheck = await pool.query(
    `SELECT id, date_debut, heure_debut, heure_fin 
     FROM disponibilites 
     WHERE practitioner_id = $1 
       AND clinique_id = $2
       AND id != $3
       AND date_debut <= $4 
       AND date_fin >= $5
       AND (
         (heure_debut < $6 AND heure_fin > $7)
         OR (heure_debut < $8 AND heure_fin > $9)
         OR (heure_debut >= $10 AND heure_fin <= $11)
       )`,
    [
      practitionerId, clinique_id, slotId,
      date_fin, date_debut,
      heure_debut, heure_debut,
      heure_fin, heure_fin,
      heure_debut, heure_fin
    ]
  );

  if (overlapCheck.rows.length > 0) {
    const conflict = overlapCheck.rows[0];
    const err = new Error(
      `⚠️ Conflit de créneau : vous avez déjà un créneau le ${new Date(conflict.date_debut).toLocaleDateString('fr-FR')} de ${conflict.heure_debut} à ${conflict.heure_fin} dans cette clinique.`
    );
    err.status = 409; // Conflict
    throw err;
  }

  // ✅ 4. Mise à jour normale
  const result = await pool.query(
    `UPDATE disponibilites 
     SET clinique_id = $1, date_debut = $2, date_fin = $3, 
         heure_debut = $4, heure_fin = $5, type = $6, motif = $7
     WHERE id = $8 AND practitioner_id = $9
     RETURNING *`,
    [clinique_id, date_debut, date_fin, heure_debut, heure_fin, type, motif || null, slotId, practitionerId]
  );

  return result.rows[0];
}

export async function createDisponibilite(practitionerId, data) {
  const {
    clinique_id,
    date_debut,
    date_fin,
    heure_debut,
    heure_fin,
    type = 'disponible',
    motif = null
  } = data;

  // 1. Validation des champs obligatoires
  if (
    !clinique_id ||
    !date_debut ||
    !date_fin ||
    !heure_debut ||
    !heure_fin
  ) {
    const err = new Error('Champs obligatoires manquants');
    err.status = 400;
    throw err;
  }

  // 2. Validation du type
  const allowed = ['disponible', 'bloque', 'absence'];

  if (!allowed.includes(type)) {
    const err = new Error('Type invalide');
    err.status = 400;
    throw err;
  }

  // 3. Vérifier la cohérence des dates et des heures
  if (date_debut > date_fin) {
    const err = new Error('La date de début doit être antérieure ou égale à la date de fin');
    err.status = 400;
    throw err;
  }

  if (heure_debut >= heure_fin) {
    const err = new Error("L'heure de début doit être antérieure à l'heure de fin");
    err.status = 400;
    throw err;
  }

  // 4. Vérifier que le praticien est affecté à cette clinique
  const cliniqueCheck = await pool.query(
    `SELECT 1
     FROM practitioner_clinique
     WHERE practitioner_id = $1
       AND clinique_id = $2`,
    [practitionerId, clinique_id]
  );

  if (cliniqueCheck.rows.length === 0) {
    const err = new Error("Vous n'êtes pas affecté à cette clinique");
    err.status = 403;
    throw err;
  }

  // 4. Vérification du chevauchement des créneaux
const overlapCheck = await pool.query(
  `SELECT id, date_debut, date_fin, heure_debut, heure_fin
   FROM disponibilites
   WHERE practitioner_id = $1
     AND clinique_id = $2
     AND date_debut <= $4
     AND date_fin >= $3
     AND heure_debut < $6
     AND heure_fin > $5
   LIMIT 1`,
  [
    practitionerId,
    clinique_id,
    date_debut,
    date_fin,
    heure_debut,
    heure_fin
  ]
);

if (overlapCheck.rows.length > 0) {
  const conflict = overlapCheck.rows[0];

  const err = new Error(
    `Conflit de créneau : vous avez déjà une période de ${conflict.heure_debut} à ${conflict.heure_fin} dans cette clinique.`
  );

  err.status = 409;
  throw err;
}

  // 6. Insérer le nouveau créneau
  const result = await pool.query(
    `INSERT INTO disponibilites (
      practitioner_id,
      clinique_id,
      date_debut,
      date_fin,
      heure_debut,
      heure_fin,
      type,
      motif
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      practitionerId,
      clinique_id,
      date_debut,
      date_fin,
      heure_debut,
      heure_fin,
      type,
      motif
    ]
  );

  return result.rows[0];
}


export async function deleteDisponibilite(practitionerId, id) {
  const result = await pool.query(
    `DELETE FROM disponibilites WHERE id = $1 AND practitioner_id = $2 RETURNING id`,
    [id, practitionerId]
  );
  if (result.rows.length === 0) {
    const err = new Error('Disponibilité non trouvée ou non autorisée');
    err.status = 404;
    throw err;
  }
  return { deleted: true };
}

export async function searchMyPatients(practitionerId, q = '') {
  const search = q.trim().toLowerCase();
  const searchDigits = search.replace(/\D/g, '');

  const result = await pool.query(
    `SELECT DISTINCT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        (SELECT MAX(a.appointment_date)
         FROM appointments a
         WHERE a.patient_id = u.id
           AND a.practitioner_id = $1) AS last_appointment,
        (SELECT COUNT(*)
         FROM appointments a
         WHERE a.patient_id = u.id
           AND a.practitioner_id = $1) AS total_appointments
     FROM users u
     WHERE u.role = 'patient'
       AND (
         EXISTS (
           SELECT 1 FROM appointments a
           WHERE a.patient_id = u.id
             AND a.practitioner_id = $1
         )
         OR EXISTS (
           SELECT 1 FROM medical_records m
           WHERE m.patient_id = u.id
             AND m.practitioner_id = $1
         )
       )
     ORDER BY last_appointment DESC NULLS LAST, u.full_name ASC`,
    [practitionerId]
  );

  // Déchiffrer les téléphones et conserver la compatibilité
  // avec les anciens numéros qui étaient enregistrés en clair.
  const patients = result.rows.map(patient => {
    let phone = patient.phone;

    if (phone && phone.includes(':')) {
      phone = decrypt(phone);
    }

    return {
      ...patient,
      phone
    };
  });

  // Recherche par nom, email, ID ou numéro de téléphone.
  const filteredPatients = search
    ? patients.filter(patient => {
        const matchesName =
          patient.full_name?.toLowerCase().includes(search);

        const matchesEmail =
          patient.email?.toLowerCase().includes(search);

        const matchesId =
          String(patient.id) === search;

        const patientPhoneDigits =
          (patient.phone || '').replace(/\D/g, '');

        const matchesPhone =
          searchDigits.length > 0 &&
          patientPhoneDigits.includes(searchDigits);

        return matchesName || matchesEmail || matchesId || matchesPhone;
      })
    : patients;

  return filteredPatients.slice(0, 50);
}

export async function getPatientRecords(practitionerId, patientId, ip = null) {
  const check = await pool.query(
    `SELECT 1 FROM users u WHERE u.id = $1 AND u.role = 'patient'
     AND (EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = u.id AND a.practitioner_id = $2)
          OR EXISTS (SELECT 1 FROM medical_records m WHERE m.patient_id = u.id AND m.practitioner_id = $2))`,
    [patientId, practitionerId]
  );

  if (check.rows.length === 0) {
    await pool.query(
      `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip) VALUES ($1, 'ACCESS_DENIED', $2, $3)`,
      [practitionerId, `Tentative accès dossier patient #${patientId}`, ip]
    );
    const err = new Error('Accès non autorisé à ce dossier');
    err.status = 403;
    throw err;
  }

  await pool.query(
    `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip) VALUES ($1, 'VIEW_RECORD', $2, $3)`,
    [practitionerId, `Dossier patient #${patientId}`, ip]
  );

  const patient = await pool.query(
  `SELECT id, full_name, email, phone FROM users WHERE id = $1`,
  [patientId]
);

const patientData = patient.rows[0];

if (patientData) {
  if (patientData.phone && patientData.phone.includes(':')) {
    patientData.phone = decrypt(patientData.phone);
  }
}
  const records = await pool.query(
    `SELECT m.id, m.title, m.diagnosis, m.notes, m.record_date, m.created_at, u.full_name AS practitioner_name
     FROM medical_records m LEFT JOIN users u ON m.practitioner_id = u.id
     WHERE m.patient_id = $1 ORDER BY m.record_date DESC, m.created_at DESC`,
    [patientId]
  );
 const labResults = await pool.query(
  `SELECT
      lr.id,
      lr.patient_id,
      lr.practitioner_id,
      lr.test_name,
      lr.result_value,
      lr.unit,
      lr.reference_range,
      lr.status,
      lr.result_date,
      lr.created_at,
      u.full_name AS practitioner_name
   FROM lab_results lr
   LEFT JOIN users u ON lr.practitioner_id = u.id
   WHERE lr.patient_id = $1
   ORDER BY lr.result_date DESC, lr.created_at DESC`,
  [patientId]
);

  return {
  patient: patientData,
  records: records.rows,
  labResults: labResults.rows,
  audit_logged: true
};
}


export async function createMedicalRecord(practitionerId, data) {
  const { patient_id, title, diagnosis, notes, record_date } = data;

  // 1. Vérifier les champs obligatoires
  if (!patient_id || !title) {
    const err = new Error('patient_id et title sont obligatoires');
    err.status = 400;
    throw err;
  }

  // 2. Vérifier le format de la date
  if (record_date) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!datePattern.test(record_date)) {
      const err = new Error('Format de date invalide. Utilisez YYYY-MM-DD.');
      err.status = 400;
      throw err;
    }

    // Vérifier que la date existe réellement
    const parsedDate = new Date(`${record_date}T00:00:00Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== record_date
    ) {
      const err = new Error('Date du compte rendu invalide.');
      err.status = 400;
      throw err;
    }

    // 3. Interdire une date future
    const dateCheck = await pool.query(
      `SELECT $1::date > CURRENT_DATE AS is_future`,
      [record_date]
    );

    if (dateCheck.rows[0].is_future) {
      const err = new Error(
        'La date du compte rendu ne peut pas être dans le futur.'
      );
      err.status = 400;
      throw err;
    }
  }

  // 4. Vérifier que le patient est autorisé pour ce praticien
  const check = await pool.query(
    `SELECT 1
     FROM users u
     WHERE u.id = $1
       AND u.role = 'patient'
       AND (
         EXISTS (
           SELECT 1
           FROM appointments a
           WHERE a.patient_id = u.id
             AND a.practitioner_id = $2
         )
         OR EXISTS (
           SELECT 1
           FROM medical_records m
           WHERE m.patient_id = u.id
             AND m.practitioner_id = $2
         )
       )`,
    [patient_id, practitionerId]
  );

  if (check.rows.length === 0) {
    const err = new Error('Patient non autorisé pour ce praticien');
    err.status = 403;
    throw err;
  }

  // 5. Insérer le compte rendu
  const result = await pool.query(
    `INSERT INTO medical_records (
       patient_id,
       practitioner_id,
       title,
       diagnosis,
       notes,
       record_date
     )
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE))
     RETURNING id, patient_id, practitioner_id, title,
               diagnosis, notes, record_date, created_at`,
    [
      patient_id,
      practitionerId,
      title,
      diagnosis || null,
      notes || null,
      record_date || null
    ]
  );

  // 6. Enregistrer l'action dans le journal d'audit
  await pool.query(
    `INSERT INTO journal_audit (
       utilisateur_id,
       action,
       ressource,
       adresse_ip
     )
     VALUES ($1, 'CREATE_RECORD', $2, $3)`,
    [
      practitionerId,
      `Compte-rendu #${result.rows[0].id} patient #${patient_id}`,
      null
    ]
  );

  return result.rows[0];
}



export async function createLabResult(practitionerId, data) {
  const {
    patient_id,
    test_name,
    result_value,
    unit,
    reference_range,
    status = 'normal',
    result_date
  } = data;

  // 1. Vérifier l'identifiant du praticien
  const practitionerDbId = Number(practitionerId);

  if (
    practitionerId === null ||
    practitionerId === undefined ||
    practitionerId === '' ||
    !Number.isInteger(practitionerDbId) ||
    practitionerDbId <= 0
  ) {
    const err = new Error('Identifiant du praticien invalide');
    err.status = 401;
    throw err;
  }

  // 2. Vérifier les données obligatoires
  const patientId = Number(patient_id);

  if (
    patient_id === null ||
    patient_id === undefined ||
    !Number.isInteger(patientId) ||
    patientId <= 0 ||
    typeof test_name !== 'string' ||
    !test_name.trim()
  ) {
    const err = new Error('patient_id et test_name sont obligatoires et valides');
    err.status = 400;
    throw err;
  }

  // 3. Vérifier le statut
  const allowedStatus = ['normal', 'abnormal', 'critical'];

  if (!allowedStatus.includes(status)) {
    const err = new Error('Statut invalide');
    err.status = 400;
    throw err;
  }

  // 4. Vérifier que le praticien existe
  const practitionerCheck = await pool.query(
    `SELECT id
     FROM users
     WHERE id = $1
       AND role = 'practitioner'`,
    [practitionerDbId]
  );

  if (practitionerCheck.rows.length === 0) {
    const err = new Error('Praticien introuvable ou non autorisé');
    err.status = 403;
    throw err;
  }

  // 5. Vérifier que le patient est associé au praticien
  const patientCheck = await pool.query(
    `SELECT 1
     FROM users u
     WHERE u.id = $1
       AND u.role = 'patient'
       AND (
         EXISTS (
           SELECT 1
           FROM appointments a
           WHERE a.patient_id = u.id
             AND a.practitioner_id = $2
         )
         OR EXISTS (
           SELECT 1
           FROM medical_records m
           WHERE m.patient_id = u.id
             AND m.practitioner_id = $2
         )
       )`,
    [patientId, practitionerDbId]
  );

  if (patientCheck.rows.length === 0) {
    const err = new Error('Patient non autorisé pour ce praticien');
    err.status = 403;
    throw err;
  }

  // 6. Insérer le résultat
  const result = await pool.query(
    `INSERT INTO lab_results (
       patient_id,
       practitioner_id,
       test_name,
       result_value,
       unit,
       reference_range,
       status,
       result_date
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       COALESCE($8::date, CURRENT_DATE)
     )
     RETURNING *`,
    [
      patientId,
      practitionerDbId,
      test_name.trim(),
      result_value || null,
      unit || null,
      reference_range || null,
      status,
      result_date || null
    ]
  );

  const createdLab = result.rows[0];

  // 7. Vérifier que l'identifiant a bien été enregistré
  if (Number(createdLab.practitioner_id) !== practitionerDbId) {
    console.error('[LAB RESULT] practitioner_id incorrect après insertion:', {
      expected: practitionerDbId,
      received: createdLab.practitioner_id,
      labId: createdLab.id
    });

    const err = new Error('Erreur lors de l’enregistrement du praticien');
    err.status = 500;
    throw err;
  }

  // 8. Enregistrer l'action dans le journal d'audit
  await pool.query(
    `INSERT INTO journal_audit (
       utilisateur_id,
       action,
       ressource,
       adresse_ip
     )
     VALUES ($1, 'PUBLISH_RESULT', $2, $3)`,
    [
      practitionerDbId,
      `Résultat #${createdLab.id} patient #${patientId}`,
      null
    ]
  );

  console.log('[LAB RESULT] Résultat créé:', {
    id: createdLab.id,
    patient_id: createdLab.patient_id,
    practitioner_id: createdLab.practitioner_id
  });

  return createdLab;
}


export async function getPatientResults(practitionerId, patientId) {
  const check = await pool.query(
    `SELECT 1 FROM users u WHERE u.id = $1 AND u.role = 'patient'
     AND (EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = u.id AND a.practitioner_id = $2)
          OR EXISTS (SELECT 1 FROM medical_records m WHERE m.patient_id = u.id AND m.practitioner_id = $2))`,
    [patientId, practitionerId]
  );

  if (check.rows.length === 0) {
    const err = new Error('Accès non autorisé');
    err.status = 403;
    throw err;
  }

  const result = await pool.query(
  `SELECT
      lr.id,
      lr.patient_id,
      lr.practitioner_id,
      lr.test_name,
      lr.result_value,
      lr.unit,
      lr.reference_range,
      lr.status,
      lr.result_date,
      lr.created_at,
      u.full_name AS practitioner_name
   FROM lab_results lr
   LEFT JOIN users u ON lr.practitioner_id = u.id
   WHERE lr.patient_id = $1
   ORDER BY lr.result_date DESC, lr.created_at DESC`,
  [patientId]
);

return result.rows;
}

// ✅ NOUVELLE FONCTION AJOUTÉE : Liste tous les comptes-rendus du praticien
export async function listAllRecords(practitionerId) {
  const result = await pool.query(
    `SELECT m.id, m.title, m.diagnosis, m.notes, m.record_date, m.created_at, 
            m.patient_id, u.full_name AS patient_name, 
            m.practitioner_id, p.full_name AS practitioner_name
     FROM medical_records m
     JOIN users u ON m.patient_id = u.id
     LEFT JOIN users p ON m.practitioner_id = p.id
     WHERE m.practitioner_id = $1
     ORDER BY m.record_date DESC, m.created_at DESC
     LIMIT 100`,
    [practitionerId]
  );
  return result.rows;
}


export async function listMyClinics(practitionerId) {
  const result = await pool.query(
    `SELECT
        c.id,
        c.nom,
        c.ville
     FROM practitioner_clinique pc
     JOIN cliniques c ON c.id = pc.clinique_id
     WHERE pc.practitioner_id = $1
     ORDER BY c.nom ASC`,
    [practitionerId]
  );

  return result.rows;
}


export async function getRecentLabResults(practitionerId) {
  const result = await pool.query(
    `SELECT
        lr.id,
        lr.patient_id,
        lr.practitioner_id,
        lr.test_name,
        lr.result_value,
        lr.unit,
        lr.reference_range,
        lr.status,
        lr.result_date,
        u.full_name AS patient_name
     FROM lab_results lr
     LEFT JOIN users u ON u.id = lr.patient_id
     WHERE lr.practitioner_id = $1
     ORDER BY lr.id DESC
     LIMIT 10`,
    [practitionerId]
  );

  return result.rows;
}
