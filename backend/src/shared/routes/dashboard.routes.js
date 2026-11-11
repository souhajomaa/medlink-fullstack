import { Router } from "express";
import pool from "../utils/db.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     summary: Récupère les statistiques du tableau de bord (adapté au rôle)
 *     description: Renvoie des données différentes si l'utilisateur est un patient ou un médecin.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Succès (le schéma de réponse dépend du rôle de l'utilisateur connecté)
 *         content:
 *           application/json:
 *             examples:
 *               patient:
 *                 summary: Réponse pour un patient
 *                 value:
 *                   role: patient
 *                   stats:
 *                     upcoming_appointments: 2
 *                     medical_records: 1
 *                     lab_results: 3
 *                   upcoming: []
 *               doctor:
 *                 summary: Réponse pour un médecin
 *                 value:
 *                   role: doctor
 *                   stats:
 *                     today_appointments: 5
 *                     pending_appointments: 1
 *                     total_patients: 42
 *       401:
 *         description: Non authentifié
 *       500:
 *         description: Erreur serveur
 */

// Dashboard patient / praticien. L'admin a son propre endpoint : GET /api/admin/stats
router.get(
  "/",
  authenticate,
  requireRole("patient", "practitioner"),
  async (req, res) => {
    try {
      if (req.user.role === "patient") {
        const [appts, records, results] = await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS n FROM appointments WHERE patient_id = $1 AND status IN ('pending','confirmed')`,
            [req.user.id],
          ),
          pool.query(
            `SELECT COUNT(*)::int AS n FROM medical_records WHERE patient_id = $1`,
            [req.user.id],
          ),
          pool.query(
            `SELECT COUNT(*)::int AS n FROM lab_results WHERE patient_id = $1`,
            [req.user.id],
          ),
        ]);

        const upcoming = await pool.query(
          `SELECT a.*, u.full_name AS doctor_name, u.specialty
                 FROM appointments a JOIN users u ON a.practitioner_id = u.id
                 WHERE a.patient_id = $1 AND a.appointment_date >= CURRENT_DATE
                 ORDER BY a.appointment_date, a.appointment_time LIMIT 5`,
          [req.user.id],
        );
        return res.json({
          role: "patient",
          stats: {
            upcoming_appointments: appts.rows[0].n,
            medical_records: records.rows[0].n,
            lab_results: results.rows[0].n,
          },
          upcoming: upcoming.rows,
        });
      }

      // Dashboard praticien
      const [today, pending, patients, agenda] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS n FROM appointments WHERE practitioner_id = $1 AND appointment_date = CURRENT_DATE`,
          [req.user.id],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS n FROM appointments WHERE practitioner_id = $1 AND status = 'pending'`,
          [req.user.id],
        ),
        pool.query(
          `SELECT COUNT(DISTINCT patient_id)::int AS n FROM appointments WHERE practitioner_id = $1`,
          [req.user.id],
        ),
        pool.query(
          `SELECT a.*, p.full_name AS patient_name
                 FROM appointments a JOIN users p ON a.patient_id = p.id
                 WHERE a.practitioner_id = $1 AND a.appointment_date = CURRENT_DATE
                 ORDER BY a.appointment_time`,
          [req.user.id],
        ),
      ]);

      res.json({
        role: "practitioner",
        stats: {
          today_appointments: today.rows[0].n,
          pending_appointments: pending.rows[0].n,
          total_patients: patients.rows[0].n,
        },
        today: agenda.rows,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

export default router;
