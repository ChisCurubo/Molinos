import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const fichaController = factory.nomina.getEmpleadoFichaController();
const liquidacionController = factory.nomina.getNominaLiquidacionController();

/**
 * @swagger
 * /nomina/empleados/{id}/ficha:
 *   get:
 *     summary: Ficha 360 del empleado (datos, salario vigente, liquidaciones, bonos, préstamos activos, prestaciones estimadas)
 *     tags: [Empleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: anio
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Ficha del empleado }
 *       404: { description: Empleado no encontrado }
 */
router.get('/:id/ficha', fichaController.obtener);

/**
 * @swagger
 * /nomina/empleados/{id}/prestaciones:
 *   get:
 *     summary: Prestaciones sociales estimadas del empleado en un año (cesantías, intereses, prima, vacaciones)
 *     tags: [NominaLiquidaciones]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: anio
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Prestaciones estimadas }
 */
router.get('/:id/prestaciones', liquidacionController.prestaciones);

export default router;
