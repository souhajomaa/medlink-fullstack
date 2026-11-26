import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet"; // ✅ US-61
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

// =================================================================
// 🛡️ CONFIGURATION DE SÉCURITÉ (Doit être en TOUT PREMIER)
// =================================================================

// 1. Faire confiance au premier proxy (Nginx/Docker) pour lire les vrais en-têtes (IP, HTTPS)
app.set('trust proxy', 1);

// 2. En-têtes de sécurité HTTP (US-61) Helmet avec CSP personnalisé + Anti-clickjacking
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Nécessaire pour React
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:3000", "http://localhost:4000", "http://localhost:8081"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"], // Anti-clickjacking
    },
  },
  crossOriginEmbedderPolicy: false, // Évite les problèmes avec certains assets React
}));

app.disable('x-powered-by');

// 3. FORCER HTTPS (US-44) - DOIT être avant les routes pour bloquer les requêtes non sécurisées
app.use(enforceHTTPS);
// Forcer le Cache-Control (No cache pour les données sensibles)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('X-Content-Type-Options', 'nosniff'); // Renforcement supplémentaire
  next();
});
// =================================================================
// ⚙️ MIDDLEWARES GLOBAUX
// =================================================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Documentation Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "MedLink API", version: "1.0.0" });
});

// =================================================================
// 🚀 MONTAGE DES MODULES (Le cœur du monolithe modulaire)
// =================================================================
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
  console.error("❌ Erreur serveur:", err.stack);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

// =================================================================
// ▶️ DÉMARRAGE
// =================================================================
startReminderWorker();

app.listen(PORT, () => {
  console.log(`🚀 MedLink API running on http://localhost:${PORT}`);
});