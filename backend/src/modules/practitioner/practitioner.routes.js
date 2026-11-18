import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middleware/auth.js';
import {
    getAppointments,
    patchAppointmentStatus,
    getDisponibilites,
    postDisponibilite,
    removeDisponibilite,
    searchPatients,
    getPatientRecords,
    postMedicalRecord,
    postLabResult,
    getPatientResults,
    listRecords,
    putDisponibilite,
    getMyClinics,
    getRecentLabResults, // ✅ 1. IMPORT AJOUTÉ ICI
} from './practitioner.controller.js';

const router = Router();

/**
 * @swagger
 * /api/practitioner/clinics:
 *   get:
 *     summary: Liste les cliniques du praticien connecté
 *     description: Retourne uniquement les cliniques auxquelles le praticien authentifié est affecté.
 *     tags:
 *       - Praticien - US-19
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des cliniques récupérée avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 3
 *                       nom:
 *                         type: string
 *                         example: Clinique Pasteur
 *                       ville:
 *                         type: string
 *                         example: Tunis
 *       401:
 *         description: Utilisateur non authentifié
 *       403:
 *         description: Accès réservé aux praticiens
 *       500:
 *         description: Erreur serveur
 */


/**
 * @swagger
 * /api/practitioner/appointments:
 *   get:
 *     summary: Consulte l'agenda du praticien
 *     description: Retourne les rendez-vous du praticien connecté, avec possibilité de filtrer par clinique.
 *     tags:
 *       - Praticien - US-19
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clinique_id
 *         required: false
 *         schema:
 *           type: integer
 *         description: Identifiant de la clinique pour filtrer les rendez-vous
 *         example: 3
 *     responses:
 *       200:
 *         description: Rendez-vous récupérés avec succès
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       appointment_date:
 *                         type: string
 *                         format: date
 *                       appointment_time:
 *                         type: string
 *                       status:
 *                         type: string
 *                       clinique_id:
 *                         type: integer
 *                       clinique_nom:
 *                         type: string
 *                       clinique_ville:
 *                         type: string
 *       400:
 *         description: Identifiant de clinique invalide
 *       401:
 *         description: Utilisateur non authentifié
 *       403:
 *         description: Accès refusé
 *       500:
 *         description: Erreur serveur
 */


// GET /api/practitioner/appointments — Agenda du praticien (US-19)
router.get('/appointments', authenticate, requireRole('practitioner'), getAppointments);

// PATCH /api/practitioner/appointments/:id — Confirmer / Annuler / Terminer (US-19, US-20)
router.patch('/appointments/:id', authenticate, requireRole('practitioner'), patchAppointmentStatus);

// --- Disponibilités (US-18, US-21) ---
router.get('/disponibilites', authenticate, requireRole('practitioner'), getDisponibilites);
router.post('/disponibilites', authenticate, requireRole('practitioner'), postDisponibilite);
router.delete('/disponibilites/:id', authenticate, requireRole('practitioner'), removeDisponibilite);
router.put('/disponibilites/:id', authenticate, requireRole('practitioner'), putDisponibilite);

// --- Patients & dossiers (US-22, US-23, US-47) ---
router.get('/patients', authenticate, requireRole('practitioner'), searchPatients);
router.get('/patients/:id/records', authenticate, requireRole('practitioner'), getPatientRecords);
router.get('/patients/:id/results', authenticate, requireRole('practitioner'), getPatientResults);

// --- Comptes-rendus & résultats (US-24, US-25, US-26) ---
// ✅ 2. ROUTE GET /records AJOUTÉE ICI
router.get('/records', authenticate, requireRole('practitioner'), listRecords);

router.post('/patients/:id/records', authenticate, requireRole('practitioner'), postMedicalRecord);
router.post('/patients/:id/results', authenticate, requireRole('practitioner'), postLabResult);

router.get('/clinics', authenticate, requireRole('practitioner'), getMyClinics);

router.get(
  '/results/recent',
  authenticate,
  requireRole('practitioner'),
  getRecentLabResults
);

export default router;