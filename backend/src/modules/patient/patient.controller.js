import {
  listPractitioners,
  listPatientAppointments,
  bookAppointment,
  listPatientResults,
  cancelAppointment as cancelAppointmentService,
  rescheduleAppointment as rescheduleAppointmentService,
} from "./patient.service.js";

import pool from "../../shared/utils/db.js";

export async function getPractitioners(req, res) {
  try {
    const practitioners = await listPractitioners();
    res.json(practitioners);
  } catch (error) {
    console.error("Erreur lors du chargement des praticiens :", error);
    res.status(500).json({ error: "Impossible de charger les praticiens" });
  }
}

export async function getAppointments(req, res) {
  try {
    const appointments = await listPatientAppointments(req.user.id);
    res.json(appointments);
  } catch (error) {
    console.error("Erreur lors du chargement des rendez-vous :", error);
    res.status(500).json({ error: "Impossible de charger les rendez-vous" });
  }
}

export async function createAppointment(req, res) {
  try {
    const appointment = await bookAppointment(req.user.id, req.body);

    res.status(201).json({
      message: "Rendez-vous demandé avec succès",
      appointment,
    });
  } catch (error) {
    const clientErrors = [
      "Praticien, date et heure sont obligatoires",
      "Praticien invalide",
      "Type de consultation invalide",
      "Format de date invalide",
      "Format de l’heure invalide",
      "Praticien introuvable",
      "Choisissez une date future",
      "Ce créneau est déjà réservé",
    ];

    if (clientErrors.includes(error.message)) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Erreur lors de la réservation :", error);
    res.status(500).json({ error: "Impossible de créer le rendez-vous" });
  }
}

export async function cancelAppointment(req, res) {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    if (isNaN(appointmentId)) {
      return res.status(400).json({ error: "ID invalide" });
    }

    const updated = await cancelAppointmentService(req.user.id, appointmentId);
    res.json({ message: "Rendez-vous annulé", appointment: updated });
  } catch (error) {
    const status = error.message.includes("introuvable") ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

export async function rescheduleAppointment(req, res) {
  try {
    const appointmentId = parseInt(req.params.id, 10);
    const { appointment_date, appointment_time } = req.body;

    if (isNaN(appointmentId)) {
      return res.status(400).json({ error: "ID invalide" });
    }

    const updated = await rescheduleAppointmentService(
      req.user.id,
      appointmentId,
      appointment_date,
      appointment_time,
    );

    res.json({ message: "Rendez-vous reporté", appointment: updated });
  } catch (error) {
    const status = error.message.includes("introuvable") ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
}

export async function getResults(req, res) {
  try {
    const results = await listPatientResults(req.user.id);

    await pool.query(
      `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip) 
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.id,
        "VIEW_RESULTS",
        "Consultation des résultats médicaux",
        req.ip,
      ],
    );

    res.json(results);
  } catch (error) {
    console.error("Erreur lors du chargement des résultats :", error);
    res.status(500).json({ error: "Impossible de charger les résultats" });
  }
}
