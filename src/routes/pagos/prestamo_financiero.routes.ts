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

export default router;
