import { Router } from 'express';
import { AuthController } from '../../controllers/auth/auth.controller';
import { UsuarioController } from '../../controllers/auth/usuario.controller';

const router = Router();
const authController = new AuthController();
const usuarioController = new UsuarioController();

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
 *               - correo
 *               - contrasena
 *             properties:
 *               correo:
 *                 type: string
 *                 example: admin@molinos.com
 *               contrasena:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Login exitoso. Retorna el token.
 *       401:
 *         description: Credenciales inválidas.
 */
router.post('/login', authController.login);

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
