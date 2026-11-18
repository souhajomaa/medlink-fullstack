
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
    getRecentLabResults,
} from './practitioner.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Practitioner
 *     description: Gestion des fonctionnalités du praticien dans MedLink
 *
 * components:
 *   schemas:
 *     PractitionerClinic:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 3
 *         nom:
 *           type: string
 *           example: Clinique Pasteur
 *         ville:
 *           type: string
 *           example: Tunis
 *
 *     AppointmentStatus:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *           example: confirmed
 *
 *     Disponibilite:
 *       type: object
 *       required:
 *         - clinique_id
 *         - date_debut
 *         - date_fin
 *         - heure_debut
 *         - heure_fin
 *       properties:
 *         clinique_id:
 *           type: integer
 *           example: 3
 *         date_debut:
 *           type: string
 *           format: date
 *           example: '2026-11-20'
 *         date_fin:
 *           type: string
 *           format: date
 *           example: '2026-11-20'
 *         heure_debut:
 *           type: string
 *           example: '09:00'
 *         heure_fin:
 *           type: string
 *           example: '12:00'
 *         type:
 *           type: string
 *           enum: [disponible, bloque, absence]
 *           default: disponible
 *         motif:
 *           type: string
 *           nullable: true
 *           example: Consultations générales
 *
 *     MedicalRecord:
 *       type: object
 *       required:
 *         - patient_id
 *         - title
 *       properties:
 *         patient_id:
 *           type: integer
 *           example: 15
 *         title:
 *           type: string
 *           example: Compte-rendu de consultation
 *         diagnosis:
 *           type: string
 *           nullable: true
 *           example: Grippe saisonnière
 *         notes:
 *           type: string
 *           nullable: true
 *           example: Repos et traitement prescrits
 *         record_date:
 *           type: string
 *           format: date
 *           example: '2026-11-18'
 *
 *     LabResult:
 *       type: object
 *       required:
 *         - patient_id
 *         - test_name
 *       properties:
 *         patient_id:
 *           type: integer
 *           example: 15
 *         test_name:
 *           type: string
 *           example: Glycémie
 *         result_value:
 *           type: string
 *           nullable: true
 *           example: '0.95'
 *         unit:
 *           type: string
 *           nullable: true
 *           example: g/L
 *         reference_range:
 *           type: string
 *           nullable: true
 *           example: 0.70 - 1.10
 *         status:
 *           type: string
 *           enum: [normal, abnormal, critical]
 *           default: normal
 *         result_date:
 *           type: string
 *           format: date
 *           example: '2026-11-18'
 *
 *     ApiSuccess:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *
 *     ApiError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: Erreur serveur
 */

/**
 * @swagger
 * /api/practitioner/clinics:
 *   get:
 *     summary: Consulter les cliniques du praticien
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des cliniques récupérée
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès réservé aux praticiens
 *       500:
 *         description: Erreur serveur
 */
router.get('/clinics', authenticate, requireRole('practitioner'), getMyClinics);

/**
 * @swagger
 * /api/practitioner/appointments:
 *   get:
 *     summary: Consulter les rendez-vous du praticien
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: clinique_id
 *         schema:
 *           type: integer
 *         required: false
 *         description: Filtrer les rendez-vous par clinique
 *     responses:
 *       200:
 *         description: Rendez-vous récupérés
 *       400:
 *         description: Identifiant de clinique invalide
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       500:
 *         description: Erreur serveur
 */
router.get('/appointments', authenticate, requireRole('practitioner'), getAppointments);

/**
 * @swagger
 * /api/practitioner/appointments/{id}:
 *   patch:
 *     summary: Modifier le statut d'un rendez-vous
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifiant du rendez-vous
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppointmentStatus'
 *     responses:
 *       200:
 *         description: Statut modifié avec succès
 *       400:
 *         description: Statut invalide ou manquant
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Rendez-vous introuvable ou non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.patch('/appointments/:id', authenticate, requireRole('practitioner'), patchAppointmentStatus);

/**
 * @swagger
 * /api/practitioner/disponibilites:
 *   get:
 *     summary: Consulter les disponibilités du praticien
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Disponibilités récupérées
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       500:
 *         description: Erreur serveur
 */
router.get('/disponibilites', authenticate, requireRole('practitioner'), getDisponibilites);

/**
 * @swagger
 * /api/practitioner/disponibilites:
 *   post:
 *     summary: Ajouter une disponibilité
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Disponibilite'
 *     responses:
 *       201:
 *         description: Disponibilité créée
 *       400:
 *         description: Champs obligatoires manquants ou type invalide
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Praticien non affecté à la clinique
 *       500:
 *         description: Erreur serveur
 */
router.post('/disponibilites', authenticate, requireRole('practitioner'), postDisponibilite);

/**
 * @swagger
 * /api/practitioner/disponibilites/{id}:
 *   put:
 *     summary: Modifier une disponibilité
 *     tags: [Practitioner]
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
 *             $ref: '#/components/schemas/Disponibilite'
 *     responses:
 *       200:
 *         description: Disponibilité modifiée
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Créneau ou clinique non autorisé
 *       404:
 *         description: Créneau introuvable
 *       500:
 *         description: Erreur serveur
 */
router.put('/disponibilites/:id', authenticate, requireRole('practitioner'), putDisponibilite);

/**
 * @swagger
 * /api/practitioner/disponibilites/{id}:
 *   delete:
 *     summary: Supprimer une disponibilité
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Disponibilité supprimée
 *       401:
 *         description: Non authentifié
 *       404:
 *         description: Disponibilité introuvable ou non autorisée
 *       500:
 *         description: Erreur serveur
 */
router.delete('/disponibilites/:id', authenticate, requireRole('practitioner'), removeDisponibilite);

/**
 * @swagger
 * /api/practitioner/patients:
 *   get:
 *     summary: Rechercher les patients du praticien
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *         description: Recherche par nom, email, ID ou téléphone
 *     responses:
 *       200:
 *         description: Patients récupérés (maximum 50)
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès refusé
 *       500:
 *         description: Erreur serveur
 */
router.get('/patients', authenticate, requireRole('practitioner'), searchPatients);

/**
 * @swagger
 * /api/practitioner/patients/{id}/records:
 *   get:
 *     summary: Consulter le dossier médical d'un patient
 *     description: Vérifie l'association patient-praticien et journalise l'accès.
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifiant du patient
 *     responses:
 *       200:
 *         description: Dossier médical récupéré
 *       400:
 *         description: ID patient invalide
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès non autorisé au dossier
 *       500:
 *         description: Erreur serveur
 */
router.get('/patients/:id/records', authenticate, requireRole('practitioner'), getPatientRecords);

/**
 * @swagger
 * /api/practitioner/patients/{id}/records:
 *   post:
 *     summary: Ajouter un compte-rendu médical
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifiant du patient dans l'URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MedicalRecord'
 *     responses:
 *       201:
 *         description: Compte-rendu créé
 *       400:
 *         description: Patient ID ou titre manquant
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Patient non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/patients/:id/records', authenticate, requireRole('practitioner'), postMedicalRecord);

/**
 * @swagger
 * /api/practitioner/patients/{id}/results:
 *   get:
 *     summary: Consulter les résultats d'analyse d'un patient
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifiant du patient
 *     responses:
 *       200:
 *         description: Résultats récupérés
 *       400:
 *         description: ID patient invalide
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.get('/patients/:id/results', authenticate, requireRole('practitioner'), getPatientResults);

/**
 * @swagger
 * /api/practitioner/patients/{id}/results:
 *   post:
 *     summary: Ajouter un résultat d'analyse médicale
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifiant du patient dans l'URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LabResult'
 *     responses:
 *       201:
 *         description: Résultat enregistré
 *       400:
 *         description: Données invalides ou statut incorrect
 *       401:
 *         description: Identifiant praticien invalide ou non authentifié
 *       403:
 *         description: Patient ou praticien non autorisé
 *       500:
 *         description: Erreur serveur
 */
router.post('/patients/:id/results', authenticate, requireRole('practitioner'), postLabResult);

/**
 * @swagger
 * /api/practitioner/records:
 *   get:
 *     summary: Consulter les comptes-rendus du praticien
 *     description: Retourne au maximum 100 comptes-rendus créés par le praticien connecté.
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Comptes-rendus récupérés
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès réservé aux praticiens
 *       500:
 *         description: Erreur serveur
 */
router.get('/records', authenticate, requireRole('practitioner'), listRecords);

/**
 * @swagger
 * /api/practitioner/results/recent:
 *   get:
 *     summary: Consulter les 10 derniers résultats d'analyse du praticien
 *     tags: [Practitioner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Résultats récents récupérés
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Accès réservé aux praticiens
 *       500:
 *         description: Erreur serveur
 */
router.get('/results/recent', authenticate, requireRole('practitioner'), getRecentLabResults);

export default router;
