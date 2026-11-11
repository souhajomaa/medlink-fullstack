import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";

// Importation des modules
import authRoutes from "./modules/auth/auth.routes.js";
import patientRoutes from "./modules/patient/patient.routes.js";
import practitionerRoutes from "./modules/practitioner/practitioner.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import dashboardRoutes from "./shared/routes/dashboard.routes.js";
import { startReminderWorker } from "./modules/patient/reminder.worker.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares globaux
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Documentation Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "MedLink API", version: "1.0.0" });
});

// Montage des modules (Le cœur du monolithe modulaire)
app.use("/api/auth", authRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/practitioner", practitionerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Gestionnaire 404
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

//Démarrage du cron de rappel
startReminderWorker();

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 MedLink API running on http://localhost:${PORT}`);
});
