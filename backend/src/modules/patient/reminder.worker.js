import cron from "node-cron";
import pool from "../../shared/utils/db.js";
import { getSecret } from "../../shared/utils/secrets.js";

export function startReminderWorker() {
  cron.schedule("* * * * *", async () => {
    try {
      const result = await pool.query(`
        SELECT a.id, a.appointment_time, u_patient.full_name AS patient_name, 
               u_practitioner.full_name AS practitioner_name
        FROM appointments a
        JOIN users u_patient ON a.patient_id = u_patient.id
        JOIN users u_practitioner ON a.practitioner_id = u_practitioner.id
        WHERE a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND a.status IN ('pending', 'confirmed')
      `);

      if (result.rows.length > 0) {
        console.log(
          `\n🔔 [RAPPEL AUTOMATIQUE] Envoi des rappels pour ${result.rows.length} rendez-vous de demain :`,
        );
        result.rows.forEach((rdv) => {
          console.log(
            `📧 À ${rdv.patient_name} : Rappel de votre RDV avec ${rdv.practitioner_name} demain à ${rdv.appointment_time}.`,
          );
        });
      }
    } catch (error) {
      console.error("Erreur dans le worker de rappel :", error);
    }
  });

  console.log("⏰ Worker de rappel automatique démarré.");
}
