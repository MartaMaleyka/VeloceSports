import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import { authLoginRateLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, registerSchema, refreshSchema, logoutSchema } from '../validators/auth.validator.js';

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicio de sesión único para todos los roles
 *     description: Un solo endpoint para super_admin, academy_admin, coach y parent.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Autenticación exitosa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     user:
 *                       type: object
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Usuario o academia inactiva/suspendida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiados intentos
 */
router.post(
  '/login',
  authLoginRateLimiter,
  validate(loginSchema),
  (req, res, next) => authController.login(req, res, next),
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renueva access token usando refresh token (con rotación)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens renovados
 *       401:
 *         description: Refresh inválido, expirado o revocado
 *       403:
 *         description: Usuario o academia inactiva
 */
router.post(
  '/refresh',
  validate(refreshSchema),
  (req, res, next) => authController.refresh(req, res, next),
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cierra sesión revocando el refresh token server-side
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesión cerrada (idempotente)
 */
router.post(
  '/logout',
  validate(logoutSchema),
  (req, res, next) => authController.logout(req, res, next),
);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registro de usuarios (solo desarrollo)
 *     description: Disponible únicamente cuando NODE_ENV no es production.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [super_admin, academy_admin, coach, parent]
 *               tenantId:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Usuario creado
 *       403:
 *         description: No disponible en producción
 *       409:
 *         description: Email ya registrado
 */
router.post(
  '/register',
  validate(registerSchema),
  (req, res, next) => authController.register(req, res, next),
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del usuario
 *       401:
 *         description: No autenticado
 */
router.get('/me', authenticate, (req, res, next) => authController.me(req, res, next));

export default router;
