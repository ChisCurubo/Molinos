import { Router } from 'express';
import { VistaMaterialController } from '../../controllers/material/vistas.material.controller';
import { factory } from '../../config/factory';

const router = Router();
const ctrl = factory.material.getVistaMaterialController();

/**
 * @swagger
 * tags:
 *   name: Vistas Material
 *   description: Vistas y reportes del módulo de material
 */

/**
 * @swagger
 * /material/vistas/estado-pago-material:
 *   get:
 *     summary: Estado de pago al minero
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de estados
 */
router.get('/estado-pago-material',                ctrl.estadoPagoMaterial);

/**
 * @swagger
 * /material/vistas/estado-pago-material/{id_entrada}:
 *   get:
 *     summary: Estado de pago de una entrada
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_entrada
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado
 */
router.get('/estado-pago-material/:id_entrada',    ctrl.estadoPagoMaterialById);

/**
 * @swagger
 * /material/vistas/estado-pago-flete:
 *   get:
 *     summary: Estado de pago del flete
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de estados
 */
router.get('/estado-pago-flete',                   ctrl.estadoPagoFlete);

/**
 * @swagger
 * /material/vistas/estado-pago-flete/{id_entrada}:
 *   get:
 *     summary: Estado flete de una entrada
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_entrada
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado
 */
router.get('/estado-pago-flete/:id_entrada',       ctrl.estadoPagoFleteById);

/**
 * @swagger
 * /material/vistas/excedente-empresa:
 *   get:
 *     summary: Excedente por entrada
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: estado_distribucion
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de excedentes
 */
router.get('/excedente-empresa',                   ctrl.excedenteEmpresa);

/**
 * @swagger
 * /material/vistas/excedente-por-vehiculo:
 *   get:
 *     summary: Excedente agrupado por vehículo
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista
 */
router.get('/excedente-por-vehiculo',              ctrl.excedentePorVehiculo);

/**
 * @swagger
 * /material/vistas/excedente-por-vehiculo/{id_vehiculo}:
 *   get:
 *     summary: Excedente de un vehículo
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_vehiculo
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Excedente
 */
router.get('/excedente-por-vehiculo/:id_vehiculo', ctrl.excedentePorVehiculoById);

/**
 * @swagger
 * /material/vistas/analisis-completo:
 *   get:
 *     summary: Análisis con referencias resueltas
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: id_minero
 *         schema:
 *           type: integer
 *       - in: query
 *         name: id_mina
 *         schema:
 *           type: integer
 *       - in: query
 *         name: desde
 *         schema:
 *           type: string
 *       - in: query
 *         name: hasta
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de análisis
 */
router.get('/analisis-completo',                   ctrl.analisisCompleto);

/**
 * @swagger
 * /material/vistas/estado-agua:
 *   get:
 *     summary: Estado de pago agua
 *     tags: [Vistas Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estado
 */
router.get('/estado-agua',                         ctrl.estadoAgua);

export default router;
