import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();

const turnoController = factory.nomina.getTurnoController();
const tipoTurnoController = factory.nomina.getTipoTurnoController();

// Rutas Turnos
/**
 * @swagger
 * tags:
 *   - name: Turnos
 *     description: Gestión de turnos
 *   - name: TiposTurno
 *     description: Gestión de tipos de turnos
 */

/**
 * @swagger
 * /nomina/turnos:
 *   get:
 *     summary: Listar turnos con filtros opcionales
 *     tags: [Turnos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: id_empleado
 *         schema:
 *           type: integer
 *         description: ID del empleado
 *       - in: query
 *         name: quincena
 *         schema:
 *           type: integer
 *         description: Número de quincena (1 o 2)
 *       - in: query
 *         name: mes
 *         schema:
 *           type: integer
 *         description: Mes (1 al 12)
 *       - in: query
 *         name: anio
 *         schema:
 *           type: integer
 *         description: Año
 *     responses:
 *       200:
 *         description: Lista de turnos
 */
router.get('/', turnoController.list);

/**
 * @swagger
 * /nomina/turnos/{id}:
 *   get:
 *     summary: Obtener turno por ID
 *     tags: [Turnos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Turno encontrado
 */
router.get('/:id', turnoController.getById);

/**
 * @swagger
 * /nomina/turnos:
 *   post:
 *     summary: Crear turno
 *     tags: [Turnos]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Turno creado exitosamente
 */
router.post('/', turnoController.create);

/**
 * @swagger
 * /nomina/turnos/{id}:
 *   put:
 *     summary: Actualizar turno
 *     tags: [Turnos]
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
 *         description: Turno actualizado exitosamente
 */
router.put('/:id', turnoController.update);

/**
 * @swagger
 * /nomina/turnos/{id}:
 *   delete:
 *     summary: Eliminar turno
 *     tags: [Turnos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Turno eliminado
 */
router.delete('/:id', turnoController.delete);

// Rutas Tipos de Turno
router.get('/tipos', tipoTurnoController.list);
router.get('/tipos/:id', tipoTurnoController.getById);
router.post('/tipos', tipoTurnoController.create);
router.put('/tipos/:id', tipoTurnoController.update);
router.delete('/tipos/:id', tipoTurnoController.delete);

export default router;
