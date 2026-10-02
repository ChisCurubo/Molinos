import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.nomina.getBonoEmpleadoController();

/**
 * @swagger
 * tags:
 *   name: BonosEmpleado
 *   description: Bonos ocasionales a empleados (sin periodicidad fija)
 */

/**
 * @swagger
 * /nomina/empleados/bonos:
 *   post:
 *     summary: Registrar un bono a un empleado
 *     tags: [BonosEmpleado]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_empleado: { type: integer }
 *               fecha: { type: string, format: date }
 *               concepto: { type: string }
 *               valor: { type: number }
 *     responses:
 *       201:
 *         description: Bono registrado
 */
router.post('/bonos', controller.registrar);

/**
 * @swagger
 * /nomina/empleados/bonos:
 *   get:
 *     summary: Listar bonos (filtrable por empleado y rango de fechas)
 *     tags: [BonosEmpleado]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: id_empleado
 *         schema: { type: integer }
 *       - in: query
 *         name: desde
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Lista de bonos
 */
router.get('/bonos', controller.listar);

/**
 * @swagger
 * /nomina/empleados/bonos/{id}:
 *   get:
 *     summary: Obtener un bono por id
 *     tags: [BonosEmpleado]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Bono encontrado }
 *       404: { description: No encontrado }
 */
router.get('/bonos/:id', controller.obtenerPorId);

/**
 * @swagger
 * /nomina/empleados/bonos/{id}:
 *   delete:
 *     summary: Eliminar un bono (solo si aún no fue pagado)
 *     tags: [BonosEmpleado]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Bono eliminado }
 *       409: { description: Ya fue pagado, no se puede eliminar }
 */
router.delete('/bonos/:id', controller.eliminar);

export default router;
