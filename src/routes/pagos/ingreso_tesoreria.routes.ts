import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.pagos.getIngresoTesoreriaController();

/**
 * @swagger
 * tags:
 *   name: Tesorería
 *   description: Ingresos reales de dinero a la empresa (distinto de Deposito, caja menor de planta)
 */

/**
 * @swagger
 * /pagos/ingresos:
 *   post:
 *     summary: Registrar un ingreso de tesorería
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_categoria: { type: integer }
 *               concepto: { type: string }
 *               valor: { type: number }
 *               fecha: { type: string, format: date }
 *               comprobante_url: { type: string }
 *     responses:
 *       201: { description: Ingreso registrado }
 */
router.post('/', controller.registrar);

/**
 * @swagger
 * /pagos/ingresos:
 *   get:
 *     summary: Listar ingresos de tesorería
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: id_categoria
 *         schema: { type: integer }
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Lista de ingresos }
 */
router.get('/', controller.listar);

/**
 * @swagger
 * /pagos/ingresos/{id}:
 *   get:
 *     summary: Ver un ingreso por id
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Ingreso encontrado }
 *       404: { description: No encontrado }
 */
router.get('/:id', controller.obtenerPorId);

/**
 * @swagger
 * /pagos/ingresos/{id}:
 *   put:
 *     summary: Editar un ingreso (409 si viene de un préstamo financiero)
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Ingreso actualizado }
 */
router.put('/:id', controller.actualizar);
router.patch('/:id', controller.actualizar);

/**
 * @swagger
 * /pagos/ingresos/{id}:
 *   delete:
 *     summary: Eliminar un ingreso (409 si viene de un préstamo financiero)
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Ingreso eliminado }
 *       409: { description: Viene de un préstamo financiero, no se puede eliminar aquí }
 */
router.delete('/:id', controller.eliminar);

export default router;
