import { Router } from "express";
import {
  getMe,
  register,
  practitionerOptions,
  signupPractitioner,
} from "./auth.controller.js";
import { authenticate } from "../../shared/middleware/auth.js";
import { registerLimiter } from "../../shared/middleware/rate-limit.js";

const router = Router();


/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Inscription d'un patient (compte créé dans Keycloak puis profil MedLink)
 *     tags: [Authentification - M1]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *               - password
 *               - acceptTerms
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *                 example: "+21622123456"
 *               password:
 *                 type: string
 *               acceptTerms:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Compte créé, email de vérification envoyé
 *       400:
 *         description: Données invalides
 *       409:
 *         description: Création impossible avec ces informations
 *       429:
 *         description: Trop de tentatives
 */
// Route publique, limitée en fréquence par adresse IP
router.post("/register", registerLimiter, register);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Récupère les informations de l'utilisateur connecté
 *     tags: [Authentification - M1]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informations de l'utilisateur
 *       401:
 *         description: Token manquant ou invalide
 */
// Route protégée : il faut un token valide pour récupérer ses infos
router.get("/me", authenticate, getMe);

/**
 * @openapi
 * /api/auth/practitioner-options:
 *   get:
 *     summary: Spécialités et cliniques proposées dans le formulaire d'inscription praticien
 *     tags: [Authentification - M1]
 *     responses:
 *       200:
 *         description: Listes des spécialités et des cliniques
 */
router.get("/practitioner-options", practitionerOptions);

/**
 * @openapi
 * /api/auth/register-practitioner:
 *   post:
 *     summary: Inscription d'un praticien (compte créé dans Keycloak puis profil MedLink, sans validation admin)
 *     tags: [Authentification - M1]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, phone, password, specialty, cliniqueId, orderNumber, acceptTerms]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string }
 *               phone: { type: string, example: "+21622123456" }
 *               password: { type: string }
 *               specialty: { type: string, example: "Cardiologie" }
 *               cliniqueId: { type: integer }
 *               orderNumber: { type: string }
 *               acceptTerms: { type: boolean }
 *     responses:
 *       201:
 *         description: Compte créé, email de vérification envoyé
 *       400:
 *         description: Données invalides
 *       409:
 *         description: Création impossible avec ces informations
 *       429:
 *         description: Trop de tentatives
 */
// Route publique, limitée en fréquence par adresse IP
router.post("/register-practitioner", registerLimiter, signupPractitioner);

export default router;
