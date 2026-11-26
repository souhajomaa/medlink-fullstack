import {
  listPractitioners,
  listPatientAppointments,
  bookAppointment,
  listPatientResults,
  updateProfile,
  listMedicalRecords,
  cancelAppointment as cancelAppointmentService,
  rescheduleAppointment as rescheduleAppointmentService,
} from "./patient.service.js";

import pool from "../../shared/utils/db.js";
import PDFDocument from "pdfkit";

export async function getPractitioners(req, res) {
  try {
    const filters = {
      specialty: req.query.specialty,
      search: req.query.search,
    };
    const practitioners = await listPractitioners(filters);
    res.json(practitioners);
  } catch (error) {
    console.error("Erreur praticiens :", error);
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

export async function updatePatientProfile(req, res) {
  try {
    const updated = await updateProfile(req.user.id, req.body);
    res.json({ message: "Profil mis à jour", user: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function getMedicalRecords(req, res) {
  try {
    const records = await listMedicalRecords(req.user.id);

    // Journalisation (US-14)
    await pool.query(
      `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.id,
        "VIEW_MEDICAL_RECORDS",
        "Consultation du dossier médical",
        req.ip,
      ],
    );

    res.json(records);
  } catch (error) {
    console.error("Erreur dossier médical :", error);
    res.status(500).json({ error: "Impossible de charger le dossier médical" });
  }
}

export async function downloadResult(req, res) {
  try {
    const resultId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `SELECT r.*, u.full_name AS patient_name
       FROM lab_results r
       JOIN users u ON r.patient_id = u.id
       WHERE r.id = $1 AND r.patient_id = $2`,
      [resultId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document introuvable" });
    }

    const data = result.rows[0];

    // Journalisation
    await pool.query(
      `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.id,
        "DOWNLOAD_RESULT",
        `Téléchargement PDF résultat #${resultId}`,
        req.ip,
      ],
    );

    // --- GÉNÉRATION DU PDF ---
    const doc = new PDFDocument();

    // On dit au navigateur que c'est un fichier PDF à télécharger
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="resultat-${resultId}.pdf"`,
    );

    // On connecte le PDF au flux de réponse
    doc.pipe(res);

    // Design du PDF
    doc
      .fontSize(20)
      .fillColor("#0F766E")
      .text("MedLink - Résultat d'Analyse", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(12)
      .fillColor("#333333")
      .text(`Patient : ${data.patient_name}`);
    doc.text(
      `Date de l'examen : ${new Date(data.result_date).toLocaleDateString("fr-FR")}`,
    );
    doc.moveDown();

    doc
      .fontSize(14)
      .fillColor("#000000")
      .text(`Examen : ${data.test_name}`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Résultat : ${data.result_value} ${data.unit}`);
    doc.text(`Valeurs de référence : ${data.reference_range}`);
    doc.text(`Statut : ${data.status.toUpperCase()}`);

    doc.moveDown(2);
    doc
      .fontSize(10)
      .fillColor("#888888")
      .text(
        "Ce document est généré automatiquement par MedLink. Document confidentiel.",
        { align: "center" },
      );

    doc.end(); // On termine le PDF
  } catch (error) {
    console.error("Erreur téléchargement PDF :", error);
    if (!res.headersSent) res.status(500).json({ error: "Erreur serveur" });
  }
}

export async function downloadMedicalRecord(req, res) {
  try {
    const recordId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `SELECT m.*, u.full_name AS patient_name, p.full_name AS practitioner_name
       FROM medical_records m
       JOIN users u ON m.patient_id = u.id
       LEFT JOIN users p ON m.practitioner_id = p.id
       WHERE m.id = $1 AND m.patient_id = $2`,
      [recordId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Dossier introuvable" });
    }

    const data = result.rows[0];

    await pool.query(
      `INSERT INTO journal_audit (utilisateur_id, action, ressource, adresse_ip)
       VALUES ($1, $2, $3, $4)`,
      [
        req.user.id,
        "DOWNLOAD_RECORD",
        `Téléchargement PDF dossier #${recordId}`,
        req.ip,
      ],
    );

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="dossier-medical-${recordId}.pdf"`,
    );
    doc.pipe(res);

    doc
      .fontSize(20)
      .fillColor("#0F766E")
      .text("MedLink - Dossier Médical", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(12)
      .fillColor("#333333")
      .text(`Patient : ${data.patient_name}`);
    doc.text(`Praticien : ${data.practitioner_name || "Non spécifié"}`);
    doc.text(
      `Date : ${new Date(data.record_date).toLocaleDateString("fr-FR")}`,
    );
    doc.moveDown();

    doc
      .fontSize(14)
      .fillColor("#000000")
      .text(`Titre : ${data.title}`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Diagnostic : ${data.diagnosis}`);
    doc.moveDown(0.5);
    doc.text(`Notes : ${data.notes}`);

    doc.moveDown(2);
    doc
      .fontSize(10)
      .fillColor("#888888")
      .text("Document confidentiel généré par MedLink.", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("Erreur téléchargement PDF :", error);
    if (!res.headersSent) res.status(500).json({ error: "Erreur serveur" });
  }
}
