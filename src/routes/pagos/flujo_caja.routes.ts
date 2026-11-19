import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.pagos.getFlujoCajaController();

/**
 * @swagger
 * /pagos/vistas/flujo-caja:
 *   get:
 *     summary: Flujo de caja del mes (ingresos reales vs. gastos reales) y saldo acumulado histórico
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: mes
 *         schema: { type: integer }
 *       - in: query
 *         name: anio
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Resumen del mes (tesorería + cobros CxC vs. gastos CxP, solo métodos de caja real)
 */
router.get('/vistas/flujo-caja', controller.resumenMensual);

/**
 * @swagger
 * /pagos/vistas/flujo-caja/historico:
 *   get:
 *     summary: Saldo acumulado histórico total (todos los ingresos vs. todos los gastos reales)
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Totales históricos }
 */
router.get('/vistas/flujo-caja/historico', controller.historico);

/**
 * @swagger
 * /pagos/vistas/flujo-caja/anual:
 *   get:
 *     summary: Flujo de caja de un año calendario completo, desglosado mes a mes (reemplaza el loop de 12 llamadas a /flujo-caja)
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: anio
 *         schema: { type: integer }
 *         description: Año a consultar (default año actual)
 *     responses:
 *       200:
 *         description: Totales del año + un desglose por cada uno de los 12 meses (ingresos, gastos, saldo_mes)
 */
router.get('/vistas/flujo-caja/anual', controller.anual);

/**
 * @swagger
 * /pagos/vistas/libro-gastos:
 *   get:
 *     summary: Libro de transacciones de gastos reales del período — un registro por abono (no agregado por categoría)
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: mes
 *         schema: { type: integer }
 *       - in: query
 *         name: anio
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de abonos reales del período (material, flete, agua, combustible, mulas, alquileres, gasto directo, etc.)
 */
router.get('/vistas/libro-gastos', controller.libroGastos);

/**
 * @swagger
 * /pagos/vistas/libro-cobros:
 *   get:
 *     summary: Libro de transacciones de cobros reales del período — un registro por abono (no agregado por categoría)
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: mes
 *         schema: { type: integer }
 *       - in: query
 *         name: anio
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de cobros reales del período
 */
router.get('/vistas/libro-cobros', controller.libroCobros);

export default router;
