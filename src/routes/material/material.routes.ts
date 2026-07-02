import { Router } from 'express';
import { MaterialEntradaController, PrecioMaterialController } from '../../controllers/material/material.controller';

const router = Router();
const materialController = new MaterialEntradaController();
const precioController = new PrecioMaterialController();

/**
 * @swagger
 * tags:
 *   name: Material
 *   description: Gestión de llegadas de volquetas y entradas de material a planta
 */

/**
 * @swagger
 * /material/entrada:
 *   post:
 *     summary: Registrar llegada de una volqueta a la planta (Fase 1)
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_vehiculo:
 *                 type: integer
 *                 example: 1
 *               numero_volqueta:
 *                 type: string
 *                 example: "V-001"
 *               id_mina:
 *                 type: integer
 *                 example: 1
 *               id_tipo_material:
 *                 type: integer
 *                 example: 1
 *               peso_llegada_planta:
 *                 type: number
 *                 example: 12000.5
 *     responses:
 *       201:
 *         description: Entrada registrada exitosamente
 */
router.post('/entrada', materialController.registrarLlegada);

/**
 * @swagger
 * /material/entradas:
 *   get:
 *     summary: Listar todas las entradas registradas (con filtros opcionales)
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fechaDesde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicio (ej. 2026-01-01)
 *       - in: query
 *         name: fechaHasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin (ej. 2026-12-31)
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *         description: Estado (ej. 'PENDIENTE')
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/entradas', materialController.listarEntradas);

/**
 * @swagger
 * /material/pendientes:
 *   get:
 *     summary: Listar entradas pendientes de análisis de laboratorio
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Entradas sin tenor ni humedad asignada
 */
router.get('/pendientes', materialController.pendientesLaboratorio);

/**
 * @swagger
 * /material/precio/calcular:
 *   get:
 *     summary: Simular cálculo del precio aplicable según los parámetros dados
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: idMinero
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del Minero
 *       - in: query
 *         name: metodo
 *         schema:
 *           type: string
 *         required: true
 *         description: Método de cálculo (ej. 'por_gramo')
 *       - in: query
 *         name: tenorFalso
 *         schema:
 *           type: number
 *         required: true
 *         description: Tenor Falso
 *       - in: query
 *         name: fechaEntrada
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Fecha de llegada a planta (ej. 2026-06-30)
 *     responses:
 *       200:
 *         description: Detalles de la regla de precio aplicada
 */
router.get('/precio/calcular', precioController.buscarPrecio);

export default router;
