import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const ctrl = factory.material.getTarifaProcesoController();

/**
 * @swagger
 * tags:
 *   name: Tarifas de Proceso
 *   description: Tarifas de maquila por proceso (versionadas por fecha)
 */

/**
 * @swagger
 * /material/tarifas-proceso/vigentes:
 *   get:
 *     summary: Tarifas vigentes por código (a una fecha; por defecto hoy)
 *     tags: [Tarifas de Proceso]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: fecha, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Tarifas vigentes }
 */
router.get('/vigentes', ctrl.vigentes);

/**
 * @swagger
 * /material/tarifas-proceso:
 *   get:
 *     summary: Listar tarifas (histórico completo)
 *     tags: [Tarifas de Proceso]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: codigo, schema: { type: string } }
 *       - { in: query, name: activo, schema: { type: integer, enum: [0, 1] } }
 *     responses:
 *       200: { description: Lista de tarifas }
 */
router.get('/', ctrl.listar);

/**
 * @swagger
 * /material/tarifas-proceso:
 *   post:
 *     summary: Crear una nueva vigencia de tarifa (cierra la anterior del mismo código)
 *     tags: [Tarifas de Proceso]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigo, valor]
 *             properties:
 *               codigo: { type: string, example: PROCESO_RELAVE }
 *               valor: { type: number, example: 600000 }
 *               descripcion: { type: string }
 *               unidad: { type: string, example: COP/ton }
 *               fecha_desde: { type: string, format: date }
 *     responses:
 *       201: { description: Tarifa creada }
 *       400: { description: Datos inválidos }
 */
router.post('/', ctrl.crear);

/**
 * @swagger
 * /material/tarifas-proceso/{id}:
 *   patch:
 *     summary: Corregir una tarifa existente (valor/descripcion/unidad/fechas/activo)
 *     tags: [Tarifas de Proceso]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Tarifa actualizada }
 *       404: { description: Tarifa no encontrada }
 */
router.patch('/:id', ctrl.actualizar);

export default router;
