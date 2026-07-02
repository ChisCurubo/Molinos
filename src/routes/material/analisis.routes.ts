import { Router } from 'express';
import { AnalisisController } from '../../controllers/material/analisis.controller';

const router = Router();
const controller = new AnalisisController();

/**
 * @swagger
 * tags:
 *   name: Análisis
 *   description: Gestión de análisis de laboratorio para las entradas de material
 */

/**
 * @swagger
 * /material/analisis:
 *   post:
 *     summary: Registrar resultado de análisis y disparar cálculos de precio/costo (Fases 2-5)
 *     tags: [Análisis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_entrada:
 *                 type: integer
 *                 example: 1
 *               id_tipo_analisis:
 *                 type: integer
 *                 example: 1
 *               porcentaje_humedad:
 *                 type: number
 *                 example: 0.15
 *               toneladas_secas:
 *                 type: number
 *                 example: 10.2
 *               au_gr_x_ton_falso:
 *                 type: number
 *                 example: 15.5
 *     responses:
 *       201:
 *         description: Análisis registrado y cálculos finalizados
 */
router.post('/', controller.registrarAnalisis);

/**
 * @swagger
 * /material/analisis/entrada/{id_entrada}:
 *   get:
 *     summary: Obtener todos los análisis de una entrada
 *     tags: [Análisis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_entrada
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la entrada de material
 *     responses:
 *       200:
 *         description: Lista de análisis vinculados a la entrada
 */
router.get('/entrada/:id_entrada', controller.obtenerAnalisis);

export default router;
