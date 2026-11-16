
import { Router } from "express";
import pool from "../utils/db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// GET /api/dashboard
router.get("/", authenticate, async (req, res) => {
  try {
    const { id, role } = req.user;

    // ==========================================
    // DASHBOARD PATIENT
    // ==========================================
    if (role === "patient") {
      const [appts, records, results, upcoming] = await Promise.all([
        // Nombre de rendez-vous à venir
        pool.query(
          `SELECT COUNT(*)::int AS count
           FROM appointments
           WHERE patient_id = $1
           AND status IN ('pending', 'confirmed')
           AND appointment_date >= CURRENT_DATE`,
          [id]
        ),

        // Nombre de dossiers médicaux
        pool.query(
          `SELECT COUNT(*)::int AS count
           FROM medical_records
           WHERE patient_id = $1`,
          [id]
        ),

        // Nombre de résultats d'analyses
        pool.query(
          `SELECT COUNT(*)::int AS count
           FROM lab_results
           WHERE patient_id = $1`,
          [id]
        ),

        // Prochains rendez-vous
        pool.query(
          `SELECT
              a.*,
              u.full_name AS doctor_name,
              u.specialty,
              c.ville AS clinique_ville
           FROM appointments a
           JOIN users u ON a.practitioner_id = u.id
           LEFT JOIN cliniques c ON c.id = a.clinique_id
           WHERE a.patient_id = $1
           AND a.appointment_date >= CURRENT_DATE
           AND a.status <> 'cancelled'
           ORDER BY a.appointment_date, a.appointment_time
           LIMIT 5`,
          [id]
        ),
      ]);

      return res.json({
        role: "patient",

        stats: {
          upcoming_appointments: appts.rows[0].count,
          medical_records: records.rows[0].count,
          lab_results: results.rows[0].count,
        },

        upcoming: upcoming.rows,
      });
    }

    // ==========================================
    // DASHBOARD PRACTITIONER
    // ==========================================
    if (role === "practitioner") {
      const [todayCount, pending, patients, todayList] =
        await Promise.all([
          // Nombre de rendez-vous aujourd'hui
          pool.query(
            `SELECT COUNT(*)::int AS count
             FROM appointments
             WHERE practitioner_id = $1
             AND appointment_date = CURRENT_DATE
             AND status <> 'cancelled'`,
            [id]
          ),

          // Nombre de rendez-vous en attente
          pool.query(
            `SELECT COUNT(*)::int AS count
             FROM appointments
             WHERE practitioner_id = $1
             AND status = 'pending'`,
            [id]
          ),

          // Nombre de patients suivis
          pool.query(
            `SELECT COUNT(DISTINCT patient_id)::int AS count
             FROM appointments
             WHERE practitioner_id = $1`,
            [id]
          ),
          
          //changement de a.specialty à u.specialty
          // Agenda du jour
          pool.query(
            `SELECT
                a.id,
                a.appointment_date,
                a.appointment_time,
                a.reason,
                a.type,
                a.status,
                a.specialty,
                u.full_name AS patient_name,
                c.nom AS clinique_nom,
                c.ville AS clinique_ville
             FROM appointments a
             JOIN users u ON u.id = a.patient_id
             LEFT JOIN cliniques c ON c.id = a.clinique_id
             WHERE a.practitioner_id = $1
             AND a.appointment_date = CURRENT_DATE
             AND a.status <> 'cancelled'
             ORDER BY a.appointment_time`,
            [id]
          ),
        ]);

      return res.json({
        role: "practitioner",

        stats: {
          today_appointments: todayCount.rows[0].count,
          pending_appointments: pending.rows[0].count,
          total_patients: patients.rows[0].count,
        },

        today: todayList.rows,
      });
    }

    // ==========================================
    // AUTRES RÔLES
    // ==========================================
    return res.status(403).json({
      error: "Tableau de bord non disponible pour ce rôle",
    });

  } catch (err) {
    console.error("Erreur Dashboard:", err);

    return res.status(500).json({
      error: "Erreur serveur",
    });
  }
});

export default router;