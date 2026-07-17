import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const ctrl = factory.material.getInventarioController();

/**
 * @swagger
 * tags:
 *   name: Inventario Material
 *   description: Vistas de inventario en tiempo real
 */

/**
 * @swagger
 * /material/inventario/crudo:
 *   get:
 *     summary: Material crudo pendiente de procesar
 *     tags: [Inventario Material]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de material crudo
 */
router.get('/crudo', ctrl.obtenerMaterialCrudo);

/**
 * @swagger
 * /material/inventario/concentrado:
 *   get:
 *     summary: Concentrado disponible para despachar
 *     tags: [Inventario Material]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de concentrado disponible
 */
router.get('/concentrado', ctrl.obtenerConcentrado);

/**
 * @swagger
 * /material/inventario/lote/{id}:
 *   get:
 *     summary: Resumen de un lote específico
 *     tags: [Inventario Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Resumen del lote
 */
router.get('/lote/:id', ctrl.obtenerResumenLote);

export default router;
