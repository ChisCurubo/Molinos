import { Router } from 'express';
import { factory } from '../../config/factory';
import { authMiddleware, requireRole } from '../../helpers/auth.middleware';

import { loginLimiter, forgotLimiter, resetLimiter } from '../../helpers/rate_limit';

const router = Router();
const authController = factory.auth.getAuthController();
const usuarioController = factory.auth.getUsuarioController();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticación y gestión de usuarios
 */

// Autenticación base
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: david
 *               password:
 *                 type: string
 *                 example: 123
 *     responses:
 *       200:
 *         description: Login exitoso. Retorna el token.
 *       401:
 *         description: Credenciales inválidas.
 *       400:
 *         description: Username y password son requeridos.
 */
router.post('/login', loginLimiter, authController.login);
/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Solicitar recuperación de contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Se envió la contraseña temporal
 */
router.post('/forgot-password', forgotLimiter, authController.forgotPassword);

/**
 * @swagger
 * /auth/verify:
 *   get:
 *     summary: Verificar token JWT
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Token válido
 */
router.get('/verify', authMiddleware, authController.verify);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Cambiar contraseña con el token recibido por correo
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               nuevaPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 */
router.post('/reset-password', resetLimiter, authController.resetPassword);
router.post('/logout', authController.logout);
router.post('/change-password', authMiddleware, authController.changePassword);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Recuperar contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               correo:
 *                 type: string
 *                 example: admin@molinos.com
 *     responses:
 *       200:
 *         description: Enlace enviado
 */

// CRUD Usuarios
/**
 * @swagger
 * /auth/usuarios:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 */
// Gestión de usuarios: solo David_admin (id_rol 1)
router.use('/usuarios', authMiddleware, requireRole([1]));
router.get('/usuarios', usuarioController.list);

/**
 * @swagger
 * /auth/usuarios:
 *   post:
 *     summary: Crear un nuevo usuario
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombres:
 *                 type: string
 *                 example: "Juan Pérez"
 *               correo:
 *                 type: string
 *                 example: "juan@molinos.com"
 *               contrasena:
 *                 type: string
 *                 example: "123456"
 *               id_rol:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 */
router.get('/usuarios/:id', usuarioController.getById);
router.post('/usuarios', usuarioController.create);
router.put('/usuarios/:id', usuarioController.update);
router.delete('/usuarios/:id', usuarioController.delete);

export default router;
