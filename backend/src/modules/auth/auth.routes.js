import { Router } from "express";
import { login, getMe } from "./auth.controller.js";
import { authenticate } from "../../shared/middleware/auth.js";

const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Connexion d'un utilisateur (génère un Token JWT)
 *     tags: [Authentification - M1]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "patient@medlink.tn"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Connexion réussie (retourne le token et les infos user)
 *       401:
 *         description: Identifiants invalides
 */
// Route publique : tout le monde peut essayer de se connecter
router.post("/login", login);

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

export default router;
