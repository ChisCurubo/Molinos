import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.pagos.getPrestamoFinancieroController();

/**
 * @swagger
 * tags:
 *   name: PrestamosFinancieros
 *   description: Gestión de préstamos financieros
 */

/**
 * @swagger
 * /pagos/prestamos-financieros:
 *   post:
 *     summary: Crear préstamo financiero
 *     tags: [PrestamosFinancieros]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre_prestamo:
 *                 type: string
 *               fecha_adquisicion:
 *                 type: string
 *                 format: date
 *               monto_principal:
 *                 type: number
 *               tasa_interes:
 *                 type: number
 *               saldo_pendiente:
 *                 type: number
 *               activo:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Préstamo creado exitosamente
 */
router.post('/', controller.create);

/**
 * @swagger
 * /pagos/prestamos-financieros:
 *   get:
 *     summary: Listar todos los préstamos financieros
 *     tags: [PrestamosFinancieros]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de préstamos financieros
 */
router.get('/', controller.list);

/**
 * @swagger
 * /pagos/prestamos-financieros/{id}:
 *   get:
 *     summary: Obtener préstamo financiero por ID
 *     tags: [PrestamosFinancieros]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Préstamo encontrado
 */
router.get('/:id', controller.getById);

/**
 * @swagger
 * /pagos/prestamos-financieros/{id}:
 *   put:
 *     summary: Actualizar préstamo financiero
 *     tags: [PrestamosFinancieros]
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
 *         description: Préstamo actualizado
 */
router.put('/:id', controller.update);

/**
 * @swagger
 * /pagos/prestamos-financieros/{id}:
 *   patch:
 *     summary: Actualizar parcialmente un préstamo financiero
 *     tags: [PrestamosFinancieros]
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
 *         description: Préstamo actualizado
 */
router.patch('/:id', controller.update);

/**
 * @swagger
 * /pagos/prestamos-financieros/{id}:
 *   delete:
 *     summary: Eliminar un préstamo financiero (solo si no tiene abonos/ajustes)
 *     tags: [PrestamosFinancieros]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Préstamo eliminado
 *       409:
 *         description: El préstamo ya tiene actividad y no se puede eliminar
 */
router.delete('/:id', controller.delete);

/**
 * @swagger
 * /pagos/prestamos-financieros/{id}/interes/proyeccion:
 *   get:
 *     summary: Proyectar cuánto interés se acumularía a hoy (o a `fecha`), sin persistir nada
 *     tags: [PrestamosFinancieros]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: fecha
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Meses completos a acumular + interés proyectado + saldo si se acumula
 */
router.get('/:id/interes/proyeccion', controller.proyectarInteres);

/**
 * @swagger
 * /pagos/prestamos-financieros/{id}/interes:
 *   post:
 *     summary: Acumular (capitalizar) el interés del período transcurrido desde el último movimiento
 *     tags: [PrestamosFinancieros]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fecha: { type: string, format: date }
 *     responses:
 *       201:
 *         description: Movimiento de interés registrado (incrementa saldo_pendiente)
 *       409:
 *         description: Aún no ha pasado un mes completo desde el último movimiento
 */
router.post('/:id/interes', controller.acumularInteres);

/**
 * @swagger
 * /pagos/prestamos-financieros/{id}/abonos:
 *   post:
 *     summary: Registrar un abono real al préstamo (reduce saldo_pendiente, abona la CxP persistente del préstamo)
 *     tags: [PrestamosFinancieros]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               valor: { type: number }
 *               fecha_abono: { type: string, format: date }
 *               metodo_pago: { type: string }
 *               comprobante_url: { type: string }
 *               observaciones: { type: string }
 *     responses:
 *       201:
 *         description: Abono registrado
 *       409:
 *         description: El abono supera el saldo pendiente
 */
router.post('/:id/abonos', controller.abonar);

/**
 * @swagger
 * /pagos/prestamos-financieros/{id}/movimientos:
 *   get:
 *     summary: Historial de movimientos del préstamo (intereses acumulados + abonos)
 *     tags: [PrestamosFinancieros]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de movimientos, orden cronológico
 */
router.get('/:id/movimientos', controller.listarMovimientos);

export default router;
