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

// Rutas literales (antes del /:id genérico, mismo patrón que empleado.routes.ts: si van
// después, '/:id' las captura primero — 'tipos'/'upsert'/'dia' -> Number('tipos')=NaN).
router.get('/tipos', tipoTurnoController.list);
router.get('/tipos/:id', tipoTurnoController.getById);
router.post('/tipos', tipoTurnoController.create);
router.put('/tipos/:id', tipoTurnoController.update);
router.delete('/tipos/:id', tipoTurnoController.delete);

/**
 * @swagger
 * /nomina/turnos/upsert:
 *   put:
 *     summary: Registrar/actualizar el turno de un empleado en un día (grilla de asistencia /nomina/calendario). A lo sumo un turno por (id_empleado, fecha) — upsert, no duplica.
 *     tags: [Turnos]
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
 *               id_tipo_turno: { type: integer, description: 'Requerido si presente=true (o se omite, default true)' }
 *               horas_trabajadas: { type: number, description: 'Default 8 si presente=true y no se envía; debe estar entre 1 y 24' }
 *               presente: { type: boolean, description: 'false = ausencia; fuerza horas_trabajadas=0' }
 *               es_festivo: { type: boolean, description: 'true = este día lleva recargo dominical/festivo (+75%) además del domingo, que se detecta solo' }
 *     responses:
 *       200: { description: Turno creado o actualizado }
 */
router.put('/upsert', turnoController.upsert);

/**
 * @swagger
 * /nomina/turnos/dia:
 *   delete:
 *     summary: Borrar el turno de un empleado en un día ("Sin turno (limpiar)" del calendario)
 *     tags: [Turnos]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: id_empleado
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: fecha
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Eliminado (o no existía, idempotente) }
 */
router.delete('/dia', turnoController.eliminarPorDia);

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

export default router;
