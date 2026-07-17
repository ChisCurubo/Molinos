import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();

const empleadoController = factory.nomina.getEmpleadoController();
const prestamoController = factory.nomina.getPrestamoEmpleadoController();

// Rutas Empleados
/**
 * @swagger
 * tags:
 *   - name: Empleados
 *     description: Gestión de empleados
 *   - name: PrestamosEmpleados
 *     description: Gestión de préstamos de empleados
 */

/**
 * @swagger
 * /nomina/empleados:
 *   get:
 *     summary: Listar todos los empleados
 *     tags: [Empleados]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de empleados
 */
router.get('/', empleadoController.list);

/**
 * @swagger
 * /nomina/empleados/{id}:
 *   get:
 *     summary: Obtener empleado por ID
 *     tags: [Empleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Empleado encontrado
 */
router.get('/:id', empleadoController.getById);

/**
 * @swagger
 * /nomina/empleados:
 *   post:
 *     summary: Crear empleado
 *     tags: [Empleados]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Empleado creado exitosamente
 */
router.post('/', empleadoController.create);

/**
 * @swagger
 * /nomina/empleados/{id}:
 *   put:
 *     summary: Actualizar empleado
 *     tags: [Empleados]
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
 *     responses:
 *       200:
 *         description: Empleado actualizado exitosamente
 */
router.put('/:id', empleadoController.update);

/**
 * @swagger
 * /nomina/empleados/{id}:
 *   delete:
 *     summary: Eliminar empleado
 *     tags: [Empleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Empleado eliminado
 */
router.delete('/:id', empleadoController.delete);

// Rutas Prestamos
/**
 * @swagger
 * /nomina/empleados/prestamos:
 *   post:
 *     summary: Registrar préstamo de empleado
 *     tags: [PrestamosEmpleados]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_empleado:
 *                 type: integer
 *               valor:
 *                 type: number
 *               concepto:
 *                 type: string
 *     responses:
 *       201:
 *         description: Préstamo creado exitosamente
 */
router.post('/prestamos', prestamoController.registrar.bind(prestamoController));

/**
 * @swagger
 * /nomina/empleados/prestamos/{idEmpleado}:
 *   get:
 *     summary: Listar préstamos por empleado
 *     tags: [PrestamosEmpleados]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: idEmpleado
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Préstamos del empleado
 */
router.get('/prestamos/:idEmpleado', prestamoController.listarPorEmpleado.bind(prestamoController));

/**
 * @swagger
 * /nomina/empleados/prestamos/{id}:
 *   put:
 *     summary: Actualizar préstamo de empleado
 *     tags: [PrestamosEmpleados]
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
 *               valor:
 *                 type: number
 *               concepto:
 *                 type: string
 *     responses:
 *       200:
 *         description: Préstamo actualizado
 */
router.put('/prestamos/:id', prestamoController.update.bind(prestamoController));

export default router;
