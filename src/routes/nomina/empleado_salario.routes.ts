import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.nomina.getEmpleadoSalarioController();

/**
 * @swagger
 * tags:
 *   name: SalarioEmpleados
 *   description: Configuración salarial versionada de cada empleado
 */

/**
 * @swagger
 * /nomina/empleados/{id}/salario:
 *   post:
 *     summary: Registrar una nueva vigencia salarial (cierra la anterior)
 *     tags: [SalarioEmpleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tipo_pago:
 *                 type: string
 *                 enum: [FIJO_MENSUAL, POR_DIAS, POR_HORAS]
 *               tarifa_monto:
 *                 type: number
 *               aplica_aux_transp:
 *                 type: boolean
 *               fecha_inicio:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Vigencia creada
 */
router.post('/:id/salario', controller.crear);

/**
 * @swagger
 * /nomina/empleados/{id}/salario:
 *   get:
 *     summary: Configuración salarial vigente del empleado
 *     tags: [SalarioEmpleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Vigencia actual
 *       404:
 *         description: El empleado no tiene salario configurado
 */
router.get('/:id/salario', controller.obtenerVigente);

/**
 * @swagger
 * /nomina/empleados/{id}/salario/historial:
 *   get:
 *     summary: Historial completo de vigencias salariales del empleado
 *     tags: [SalarioEmpleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historial de vigencias
 */
router.get('/:id/salario/historial', controller.historial);

/**
 * @swagger
 * /nomina/empleados/salario/{idSalario}:
 *   put:
 *     summary: Editar una vigencia salarial puntual (sin re-versionar)
 *     tags: [SalarioEmpleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: idSalario
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Vigencia actualizada
 */
router.put('/salario/:idSalario', controller.actualizar);

/**
 * @swagger
 * /nomina/empleados/salario/{idSalario}:
 *   patch:
 *     summary: Editar parcialmente una vigencia salarial puntual
 *     tags: [SalarioEmpleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: idSalario
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Vigencia actualizada
 */
router.patch('/salario/:idSalario', controller.actualizar);

/**
 * @swagger
 * /nomina/empleados/salario/{idSalario}:
 *   delete:
 *     summary: Eliminar una vigencia salarial
 *     tags: [SalarioEmpleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: idSalario
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Vigencia eliminada
 */
router.delete('/salario/:idSalario', controller.eliminar);

export default router;
