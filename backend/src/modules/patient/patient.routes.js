
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
  updatePatientProfile,
  getMedicalRecords,
  downloadResult,
  downloadMedicalRecord,
} from "./patient.controller.js";

import {
  listNotifications,
  readNotification,
  readAll,
} from "./notification.controller.js";

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

// Praticiens
router.get("/practitioners", getPractitioners);

// Rendez-vous
router.get("/appointments", getAppointments);
router.post("/appointments", bookingLimiter, createAppointment);
router.patch("/appointments/:id/cancel", cancelAppointment);
router.patch("/appointments/:id/reschedule", rescheduleAppointment);

// Résultats d'analyses
router.get("/records/results", getResults);
router.get("/records/results/:id/download", downloadResult);

// Profil patient
router.put("/profile", updatePatientProfile);

// Dossier médical
router.get("/records", getMedicalRecords);
router.get("/records/:id/download", downloadMedicalRecord);

// Notifications
router.get("/notifications", listNotifications);
router.patch("/notifications/:id/read", readNotification);
router.patch("/notifications/read-all", readAll);

export default router;
