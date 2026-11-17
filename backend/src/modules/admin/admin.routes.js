import { Router } from "express";
import { authenticate, requireRole } from "../../shared/middleware/auth.js";
import * as ctrl from "./admin.controller.js";
import * as extra from "./admin.extra.controller.js";
const router = Router();

// Tout /api/admin/* est réservé au rôle admin (RBAC de M1)
router.use(authenticate, requireRole("admin"));

// Supervision (US-15)
router.get("/stats", ctrl.getStats);

// Comptes et rôles (US-12, US-13) : l'identité et le rôle vivent dans Keycloak
router.get("/users", ctrl.listUsers);
router.post("/users", ctrl.createUser);
router.post("/users/sync", ctrl.syncUsers);
router.patch("/users/:id", ctrl.updateUser);
router.patch("/users/:id/status", ctrl.setUserStatus);
router.post("/users/:id/reset-password", ctrl.resetUserPassword);
router.delete("/users/:id", ctrl.deleteUser);

// Cliniques et affectation des praticiens (US-29)
router.get("/cliniques", ctrl.listCliniques);
router.post("/cliniques", ctrl.createClinique);
router.put("/cliniques/:id", ctrl.updateClinique);
router.delete("/cliniques/:id", ctrl.deleteClinique);
router.put("/cliniques/:id/practitioners", ctrl.setCliniquePractitioners);

// Journal d'audit (lecture seule)
router.get("/audit", ctrl.listAudit);
// Rendez-vous pris pour un patient (US-30)
router.get("/patients", extra.listPatients);
router.get("/booking-options", extra.bookingOptions);
router.get("/appointments", extra.listAppointments);
router.post("/appointments", extra.createAppointment);
router.patch("/appointments/:id/cancel", extra.cancelAppointment);

// Synthèse pour la Direction (US-50) et statistiques anonymisées (US-32, US-46)
router.get("/synthese", extra.getSynthese);
router.get("/stats/anonymized", extra.getAnonymizedStats);
router.get("/stats/export", extra.exportAnonymizedStats);

// Suivi de la baisse des appels téléphoniques (US-51)
router.get("/appels", extra.getSuivi);
router.put("/appels/semaine", extra.saveSemaine);
router.put("/appels/reference", extra.saveReference);
export default router;
