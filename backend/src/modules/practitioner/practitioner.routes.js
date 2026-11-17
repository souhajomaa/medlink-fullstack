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
    listRecords // ✅ 1. IMPORT AJOUTÉ ICI
} from './practitioner.controller.js';

const router = Router();

// GET /api/practitioner/appointments — Agenda du praticien (US-19)
router.get('/appointments', authenticate, requireRole('practitioner'), getAppointments);

// PATCH /api/practitioner/appointments/:id — Confirmer / Annuler / Terminer (US-19, US-20)
router.patch('/appointments/:id', authenticate, requireRole('practitioner'), patchAppointmentStatus);

// --- Disponibilités (US-18, US-21) ---
router.get('/disponibilites', authenticate, requireRole('practitioner'), getDisponibilites);
router.post('/disponibilites', authenticate, requireRole('practitioner'), postDisponibilite);
router.delete('/disponibilites/:id', authenticate, requireRole('practitioner'), removeDisponibilite);

// --- Patients & dossiers (US-22, US-23, US-47) ---
router.get('/patients', authenticate, requireRole('practitioner'), searchPatients);
router.get('/patients/:id/records', authenticate, requireRole('practitioner'), getPatientRecords);
router.get('/patients/:id/results', authenticate, requireRole('practitioner'), getPatientResults);

// --- Comptes-rendus & résultats (US-24, US-25, US-26) ---
// ✅ 2. ROUTE GET /records AJOUTÉE ICI
router.get('/records', authenticate, requireRole('practitioner'), listRecords);

router.post('/patients/:id/records', authenticate, requireRole('practitioner'), postMedicalRecord);
router.post('/patients/:id/results', authenticate, requireRole('practitioner'), postLabResult);

export default router;