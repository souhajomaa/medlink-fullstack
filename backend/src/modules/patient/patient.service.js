import pool from "../../shared/utils/db.js";

export async function listPractitioners(filters = {}) {
  let query = `
    SELECT u.id, u.full_name, u.specialty, 
           array_agg(DISTINCT c.nom) FILTER (WHERE c.nom IS NOT NULL) as cliniques
    FROM users u
    LEFT JOIN practitioner_clinique pc ON u.id = pc.practitioner_id
    LEFT JOIN cliniques c ON pc.clinique_id = c.id
    WHERE u.role = 'practitioner'
  `;
  const values = [];
  let index = 1;

  if (filters.specialty) {
    query += ` AND u.specialty ILIKE $${index}`;
    values.push(`%${filters.specialty}%`);
    index++;
  }

  if (filters.search) {
    query += ` AND u.full_name ILIKE $${index}`;
    values.push(`%${filters.search}%`);
    index++;
  }

  query += ` GROUP BY u.id, u.full_name, u.specialty ORDER BY u.full_name`;

  const result = await pool.query(query, values);
  return result.rows;
}

export async function listPatientAppointments(patientId) {
  const result = await pool.query(
    `
      SELECT
        a.id,
        a.appointment_date,
        a.appointment_time,
        a.reason,
        a.type,
        a.status,
        a.clinique_id,
        u.full_name AS practitioner_name,
        u.specialty,
        c.nom AS clinique_nom,
        c.ville AS clinique_ville
      FROM appointments a
      JOIN users u ON u.id = a.practitioner_id
      LEFT JOIN cliniques c ON c.id = a.clinique_id
      WHERE a.patient_id = $1
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `,
    [patientId],
  );

  return result.rows;
}

export async function bookAppointment(patientId, data) {
  const { doctor_id, appointment_date, appointment_time, reason, type } = data;

  if (!doctor_id || !appointment_date || !appointment_time) {
    throw new Error("Praticien, date et heure sont obligatoires");
  }

  const practitionerId = Number(doctor_id);

  if (!Number.isInteger(practitionerId) || practitionerId <= 0) {
    throw new Error("Praticien invalide");
  }

  const validTypes = ["consultation", "suivi", "urgence", "teleconsultation"];

  if (type && !validTypes.includes(type)) {
    throw new Error("Type de consultation invalide");
  }

  // Vérifier le format de la date et de l'heure.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment_date)) {
    throw new Error("Format de date invalide");
  }

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(appointment_time)) {
    throw new Error("Format de l’heure invalide");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Sérialiser les réservations du même praticien pour éviter
    // deux réservations simultanées du même créneau par cette API.
    await client.query("SELECT pg_advisory_xact_lock($1::integer)", [
      practitionerId,
    ]);

    const practitioner = await client.query(
      `SELECT id FROM users
       WHERE id = $1 AND role = 'practitioner'`,
      [practitionerId],
    );

    if (practitioner.rows.length === 0) {
      throw new Error("Praticien introuvable");
    }

    const requestedDate = await client.query(
      `SELECT $1::date AS appointment_date,
              CURRENT_DATE AS today`,
      [appointment_date],
    );

    if (requestedDate.rows[0].appointment_date <= requestedDate.rows[0].today) {
      throw new Error("Choisissez une date future");
    }

    const conflict = await client.query(
      `
        SELECT id
        FROM appointments
        WHERE practitioner_id = $1
          AND appointment_date = $2::date
          AND appointment_time = $3::time
          AND status IN ('pending', 'confirmed')
        LIMIT 1
      `,
      [practitionerId, appointment_date, appointment_time],
    );

    if (conflict.rows.length > 0) {
      throw new Error("Ce créneau est déjà réservé");
    }

    const result = await client.query(
      `
        INSERT INTO appointments (
          patient_id,
          practitioner_id,
          appointment_date,
          appointment_time,
          reason,
          type,
          status
        )
        VALUES ($1, $2, $3::date, $4::time, $5, $6, 'pending')
        RETURNING *
      `,
      [
        patientId,
        practitionerId,
        appointment_date,
        appointment_time,
        reason?.trim() || null,
        type || "consultation",
      ],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelAppointment(patientId, appointmentId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Anti-IDOR : on vérifie que le RDV appartient bien au patient
    const check = await client.query(
      `SELECT id, status FROM appointments 
       WHERE id = $1 AND patient_id = $2 FOR UPDATE`,
      [appointmentId, patientId],
    );

    if (check.rows.length === 0) {
      throw new Error("Rendez-vous introuvable ou non autorisé");
    }

    if (check.rows[0].status === "cancelled") {
      throw new Error("Ce rendez-vous est déjà annulé");
    }

    const result = await client.query(
      `UPDATE appointments 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [appointmentId],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rescheduleAppointment(
  patientId,
  appointmentId,
  newDate,
  newTime,
) {
  // Validation de base
  if (!newDate || !newTime) {
    throw new Error("Nouvelle date et heure obligatoires");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Vérifier que le RDV existe, appartient au patient et est encore modifiable (Anti-IDOR)
    const check = await client.query(
      `SELECT id, practitioner_id, status FROM appointments 
       WHERE id = $1 AND patient_id = $2 FOR UPDATE`,
      [appointmentId, patientId],
    );

    if (check.rows.length === 0) {
      throw new Error("Rendez-vous introuvable ou non autorisé");
    }

    if (
      check.rows[0].status === "cancelled" ||
      check.rows[0].status === "completed"
    ) {
      throw new Error("Impossible de reporter ce rendez-vous");
    }

    const practitionerId = check.rows[0].practitioner_id;

    // 2. Vérifier que le nouveau créneau est libre (avec advisory lock pour éviter les conflits)
    await client.query("SELECT pg_advisory_xact_lock($1::integer)", [
      practitionerId,
    ]);

    const conflict = await client.query(
      `SELECT id FROM appointments 
       WHERE practitioner_id = $1 
         AND appointment_date = $2::date 
         AND appointment_time = $3::time 
         AND status IN ('pending', 'confirmed')
         AND id != $4`,
      [practitionerId, newDate, newTime, appointmentId],
    );

    if (conflict.rows.length > 0) {
      throw new Error("Ce nouveau créneau est déjà réservé");
    }

    // 3. Mettre à jour le rendez-vous
    const result = await client.query(
      `UPDATE appointments 
       SET appointment_date = $1::date, appointment_time = $2::time, status = 'pending', updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [newDate, newTime, appointmentId],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPatientResults(patientId) {
  const result = await pool.query(
    `SELECT id, test_name, result_value, unit, reference_range, status, result_date 
     FROM lab_results 
     WHERE patient_id = $1 
     ORDER BY result_date DESC`,
    [patientId],
  );
  return result.rows;
}

export async function updateProfile(patientId, data) {
  const { phone, consent_given } = data;

  const result = await pool.query(
    `UPDATE users 
     SET phone = COALESCE($1, phone), 
         consent_given = COALESCE($2, consent_given)
     WHERE id = $3 AND role = 'patient'
     RETURNING id, email, full_name, phone, consent_given`,
    [phone, consent_given, patientId],
  );

  if (result.rows.length === 0) {
    throw new Error("Patient introuvable");
  }

  return result.rows[0];
}

export async function listMedicalRecords(patientId) {
  const result = await pool.query(
    `SELECT 
       m.id, m.title, m.diagnosis, m.notes, m.record_date,
       u.full_name AS practitioner_name, u.specialty
     FROM medical_records m
     LEFT JOIN users u ON m.practitioner_id = u.id
     WHERE m.patient_id = $1
     ORDER BY m.record_date DESC`,
    [patientId],
  );
  return result.rows;
}
