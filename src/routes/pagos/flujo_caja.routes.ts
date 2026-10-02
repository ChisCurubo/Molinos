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

export default router;
