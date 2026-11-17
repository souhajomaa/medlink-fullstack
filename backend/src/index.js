import express from "express";
import cors from "cors";
import dotenv from "dotenv";
//us-61 import helmet from 'helmet';
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";

// Importation des modules
import authRoutes from "./modules/auth/auth.routes.js";
import patientRoutes from "./modules/patient/patient.routes.js";
import practitionerRoutes from "./modules/practitioner/practitioner.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import dashboardRoutes from "./shared/routes/dashboard.routes.js";
import { startReminderWorker } from "./modules/patient/reminder.worker.js";
import { enforceHTTPS } from './shared/middleware/enforce-https.js';

dotenv.config({
  path: "../.env"
});

const app = express();
const PORT = process.env.PORT || 4000;

// Le backend est derrière nginx : on fait confiance à un seul proxy
// pour lire l'IP réelle du client (limitation de débit, journal d'audit).
app.set("trust proxy", 1);

// Middlewares globaux
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Documentation Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "MedLink API", version: "1.0.0" });
});
// 1. Faire confiance au premier proxy (Nginx/Docker) pour lire les vrais en-têtes
app.set('trust proxy', 1);

// 2. En-têtes de sécurité (US-61)
//us-61 app.use(helmet());

// 3. FORCER HTTPS (US-44) - DOIT ÊTRE AVANT authenticate !
app.use(enforceHTTPS);
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