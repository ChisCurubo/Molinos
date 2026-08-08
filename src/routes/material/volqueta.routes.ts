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

/**
 * @swagger
 * /material/volqueta:
 *   post:
 *     summary: Crear un vehículo (volqueta)
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_dueno_volqueta: { type: integer }
 *               placa: { type: string }
 *               tipo_vehiculo: { type: string }
 *               conductor: { type: string }
 *               conductor_cc: { type: string }
 *               capacidad_ton: { type: number }
 *               activo: { type: integer, example: 1 }
 *     responses:
 *       200: { description: Vehículo creado }
 */
router.post('/',                        ctrl.create);

/**
 * @swagger
 * /material/volqueta/{id}:
 *   put:
 *     summary: Actualizar un vehículo
 *     tags: [Volqueta]
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
 *             properties:
 *               placa: { type: string }
 *               tipo_vehiculo: { type: string }
 *               conductor: { type: string }
 *               conductor_cc: { type: string }
 *               capacidad_ton: { type: number }
 *               activo: { type: integer }
 *     responses:
 *       200: { description: Vehículo actualizado }
 *   delete:
 *     summary: Eliminar un vehículo
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Vehículo eliminado }
 */
router.put('/:id',                      ctrl.update);
router.delete('/:id',                   ctrl.delete);

/**
 * @swagger
 * /material/volqueta/dueno:
 *   get:
 *     summary: Listar dueños de volqueta
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de dueños }
 *   post:
 *     summary: Crear un dueño de volqueta
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               titular: { type: string }
 *               cc: { type: string }
 *               banco: { type: string }
 *               numero_cuenta: { type: string }
 *               alias: { type: string }
 *               telefono: { type: string }
 *               ciudad: { type: string }
 *               nequi: { type: boolean }
 *     responses:
 *       201: { description: Dueño creado }
 */
// --- Dueños de Volqueta CRUD ---
router.get('/dueno',                    duenoCtrl.list);
router.post('/dueno',                   duenoCtrl.create);

/**
 * @swagger
 * /material/volqueta/dueno/{id}:
 *   put:
 *     summary: Actualizar un dueño de volqueta
 *     tags: [Volqueta]
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
 *             properties:
 *               banco: { type: string }
 *               numero_cuenta: { type: string }
 *               nequi: { type: boolean }
 *     responses:
 *       200: { description: Dueño actualizado }
 *   delete:
 *     summary: Eliminar un dueño de volqueta
 *     tags: [Volqueta]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Dueño eliminado }
 */
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
