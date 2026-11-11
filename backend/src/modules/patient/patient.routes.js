import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate, requireRole } from "../../shared/middleware/auth.js";
import {
  getPractitioners,
  getAppointments,
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getResults,
} from "./patient.controller.js";

const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error:
      "Trop de tentatives de réservation. Veuillez réessayer dans 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Toutes les routes de ce module sont réservées aux patients connectés.
router.use(authenticate, requireRole("patient"));

/**
 * @openapi
 * /api/patient/practitioners:
 *   get:
 *     summary: Liste tous les praticiens disponibles
 *     tags: [Patient - M2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste récupérée avec succès
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé (rôle patient requis)
 */
router.get("/practitioners", getPractitioners);

/**
 * @openapi
 * /api/patient/appointments:
 *   get:
 *     summary: Liste les rendez-vous du patient connecté
 *     tags: [Patient - M2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des rendez-vous
 *       401:
 *         description: Non authentifié
 */
router.get("/appointments", getAppointments);

/**
 * @openapi
 * /api/patient/appointments:
 *   post:
 *     summary: Créer un nouveau rendez-vous
 *     tags: [Patient - M2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctor_id
 *               - appointment_date
 *               - appointment_time
 *             properties:
 *               doctor_id:
 *                 type: integer
 *                 example: 1
 *               appointment_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-01"
 *               appointment_time:
 *                 type: string
 *                 example: "09:00"
 *               reason:
 *                 type: string
 *                 example: "Consultation de suivi"
 *               type:
 *                 type: string
 *                 enum: [consultation, suivi, urgence, teleconsultation]
 *                 example: "consultation"
 *     responses:
 *       201:
 *         description: Rendez-vous créé (statut pending)
 *       400:
 *         description: Erreur de validation (date passée, format invalide)
 *       401:
 *         description: Non authentifié
 *       409:
 *         description: Créneau déjà réservé
 */
router.post("/appointments", bookingLimiter, createAppointment);

/**
 * @openapi
 * /api/patient/appointments/{id}/cancel:
 *   patch:
 *     summary: Annuler un rendez-vous
 *     tags: [Patient - M2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du rendez-vous
 *     responses:
 *       200:
 *         description: Rendez-vous annulé
 *       400:
 *         description: Impossible d'annuler (déjà annulé)
 *       404:
 *         description: Rendez-vous introuvable
 */
router.patch("/appointments/:id/cancel", cancelAppointment);

/**
 * @openapi
 * /api/patient/appointments/{id}/reschedule:
 *   patch:
 *     summary: Reporter un rendez-vous
 *     tags: [Patient - M2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [appointment_date, appointment_time]
 *             properties:
 *               appointment_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-12-20"
 *               appointment_time:
 *                 type: string
 *                 example: "14:30"
 *     responses:
 *       200:
 *         description: Rendez-vous reporté avec succès
 *       400:
 *         description: Créneau indisponible ou données invalides
 *       404:
 *         description: Rendez-vous introuvable
 */
router.patch("/appointments/:id/reschedule", rescheduleAppointment);

/**
 * @openapi
 * /api/patient/records/results:
 *   get:
 *     summary: Récupère les résultats d'analyses du patient (avec journalisation)
 *     tags: [Patient - M2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des résultats
 *       401:
 *         description: Non authentifié
 */
router.get("/records/results", getResults);

export default router;
