import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.js';
import {
  authLoginRateLimiter,
  authSignupRateLimiter,
  passwordRecoveryRateLimiter,
} from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  updateProfileSchema,
  changePasswordSchema,
  signupIndependentSchema,
  signupAcademySchema,
  passwordRecoveryRequestSchema,
  passwordRecoveryConfirmSchema,
} from '../validators/auth.validator.js';

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
 * /auth/signup-independent:
 *   post:
 *     tags: [Auth]
 *     summary: Alta pública de un padre sin academia (cuenta personal, un solo jugador)
 *     description: Crea una academia personal invisible, siembra su catálogo de acciones, y da al padre también el rol coach sobre ella para que pueda capturar en vivo.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parentFirstName, parentLastName, email, password, childFirstName, childLastName]
 *             properties:
 *               parentFirstName: { type: string }
 *               parentLastName: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               childFirstName: { type: string }
 *               childLastName: { type: string }
 *               childJerseyNumber: { type: integer }
 *     responses:
 *       201:
 *         description: Cuenta creada, tokens de sesión listos para usar
 *       409:
 *         description: El correo ya está registrado
 */
router.post(
  '/signup-independent',
  authSignupRateLimiter,
  validate(signupIndependentSchema),
  (req, res, next) => authController.signupIndependent(req, res, next),
);

/**
 * @openapi
 * /auth/signup-academy:
 *   post:
 *     tags: [Auth]
 *     summary: Alta pública de una academia real (con su primer academy_admin)
 *     description: Igual que signup-independent, la cuenta queda pendiente de aprobación de super_admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [academyName, adminFirstName, adminLastName, email, password]
 *             properties:
 *               academyName: { type: string }
 *               adminFirstName: { type: string }
 *               adminLastName: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201:
 *         description: Cuenta creada, pendiente de aprobación
 *       409:
 *         description: El correo ya está registrado
 */
router.post(
  '/signup-academy',
  authSignupRateLimiter,
  validate(signupAcademySchema),
  (req, res, next) => authController.signupAcademy(req, res, next),
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
 * /auth/password-recovery/request:
 *   post:
 *     tags: [Auth]
 *     summary: Solicitar enlace de recuperación de contraseña por email
 *     description: Responde 202 siempre (no revela si el correo existe).
 *     responses:
 *       202:
 *         description: Solicitud aceptada
 *       429:
 *         description: Demasiadas solicitudes
 */
router.post(
  '/password-recovery/request',
  passwordRecoveryRateLimiter,
  validate(passwordRecoveryRequestSchema),
  (req, res) => authController.requestPasswordRecovery(req, res),
);

/**
 * @openapi
 * /auth/password-recovery/confirm:
 *   post:
 *     tags: [Auth]
 *     summary: Restablecer la contraseña con el token recibido por email
 *     responses:
 *       200:
 *         description: Contraseña actualizada y sesiones cerradas
 *       400:
 *         description: Token inválido, usado o expirado (code PASSWORD_RECOVERY_INVALID)
 */
router.post(
  '/password-recovery/confirm',
  passwordRecoveryRateLimiter,
  validate(passwordRecoveryConfirmSchema),
  (req, res, next) => authController.confirmPasswordRecovery(req, res, next),
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

router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  (req, res, next) => authController.updateMe(req, res, next),
);

router.patch(
  '/password',
  authenticate,
  validate(changePasswordSchema),
  (req, res, next) => authController.changePassword(req, res, next),
);

export default router;
