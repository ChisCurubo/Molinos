import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const ctrl = factory.pagos.getDeudaController();

/**
 * @swagger
 * tags:
 *   name: Deudas y Vistas Pagos
 *   description: Consultas de deudas y reportes de pagos
 */

// Deudas con mineros (material)
/**
 * @swagger
 * /pagos/deuda/material:
 *   get:
 *     summary: Deuda total con mineros
 *     tags: [Deudas y Vistas Pagos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de deudas
 */
router.get('/deuda/material',              ctrl.deudaMaterial);

/**
 * @swagger
 * /pagos/deuda/material/minero/{id}:
 *   get:
 *     summary: Deuda con un minero
 *     tags: [Deudas y Vistas Pagos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de deudas
 */
router.get('/deuda/material/minero/:id',   ctrl.deudaMaterialMinero);

// Deudas de flete (dueños de volqueta)
/**
 * @swagger
 * /pagos/deuda/flete:
 *   get:
 *     summary: Deuda total de fletes
 *     tags: [Deudas y Vistas Pagos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de deudas
 */
router.get('/deuda/flete',                 ctrl.deudaFlete);

/**
 * @swagger
 * /pagos/deuda/flete/dueno/{id}:
 *   get:
 *     summary: Deuda flete de un dueño
 *     tags: [Deudas y Vistas Pagos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de deudas
 */
router.get('/deuda/flete/dueno/:id',       ctrl.deudaFleteDueno);

// Dashboard general
/**
 * @swagger
 * /pagos/deuda/resumen-general:
 *   get:
 *     summary: Resumen general de deudas
 *     tags: [Deudas y Vistas Pagos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Resumen
 */
router.get('/deuda/resumen-general',       ctrl.resumenGeneral);

// Vistas
/**
 * @swagger
 * /pagos/vistas/estado-alquileres:
 *   get:
 *     summary: Estado de alquileres
 *     tags: [Deudas y Vistas Pagos]
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
router.get('/vistas/estado-alquileres',   ctrl.estadoAlquileres);

/**
 * @swagger
 * /pagos/vistas/estado-combustible:
 *   get:
 *     summary: Estado de combustible
 *     tags: [Deudas y Vistas Pagos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de estados
 */
router.get('/vistas/estado-combustible',  ctrl.estadoCombustible);

/**
 * @swagger
 * /pagos/vistas/estado-mulas:
 *   get:
 *     summary: Estado de mulas
 *     tags: [Deudas y Vistas Pagos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de estados
 */
router.get('/vistas/estado-mulas',        ctrl.estadoMulas);

/**
 * @swagger
 * /pagos/vistas/saldos-a-favor:
 *   get:
 *     summary: Saldos a favor
 *     tags: [Deudas y Vistas Pagos]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de saldos
 */
router.get('/vistas/saldos-a-favor',      ctrl.saldosAFavor);

export default router;
