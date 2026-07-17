import { Router } from 'express';
import { VehiculoController } from '../../controllers/material/vehiculo.controller';
import { factory } from '../../config/factory';

const router = Router();
const ctrl = factory.material.getVehiculoController();
const duenoCtrl = factory.material.getDuenoVolquetaController();

/**
 * @swagger
 * tags:
 *   name: Volqueta
 *   description: Gestión de vehículos y dueños de volqueta
 */

/**
 * @swagger
 * /material/volqueta:
 *   get:
 *     summary: Listar todos los vehículos
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de vehículos
 */
router.get('/',                         ctrl.list);
router.post('/',                        ctrl.create);
router.put('/:id',                      ctrl.update);
router.delete('/:id',                   ctrl.delete);

// --- Dueños de Volqueta CRUD ---
router.post('/dueno',                   duenoCtrl.create);
router.put('/dueno/:id',                duenoCtrl.update);
router.delete('/dueno/:id',             duenoCtrl.delete);

/**
 * @swagger
 * /material/volqueta/dueno/{id_dueno}:
 *   get:
 *     summary: Vehículos de un dueño
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_dueno
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de vehículos
 */
router.get('/dueno/:id_dueno',          ctrl.listarPorDueno);

/**
 * @swagger
 * /material/volqueta/{id}:
 *   get:
 *     summary: Detalle de vehículo
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle del vehículo
 */
router.get('/:id',                      ctrl.getById);

/**
 * @swagger
 * /material/volqueta/{id}/entradas:
 *   get:
 *     summary: Entradas históricas del vehículo
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/:id/entradas',             ctrl.listarEntradas);

/**
 * @swagger
 * /material/volqueta/{id}/entradas/pendientes:
 *   get:
 *     summary: Entradas con flete pendiente
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de entradas pendientes de pago
 */
router.get('/:id/entradas/pendientes',  ctrl.entradasPendientes);

export default router;
