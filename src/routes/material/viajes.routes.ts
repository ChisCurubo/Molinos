import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const viajesController = factory.material.getViajesController();

/**
 * @swagger
 * /material/viajes:
 *   post:
 *     summary: Crear la cabecera de un nuevo viaje
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_cliente:
 *                 type: integer
 *               conductor:
 *                 type: string
 *               placa:
 *                 type: string
 *     responses:
 *       201:
 *         description: Viaje creado
 */
router.post('/', viajesController.crearCabecera);

/**
 * @swagger
 * /material/viajes/{id}/lineas:
 *   post:
 *     summary: Asignar un lote de concentrado a un viaje
 *     tags: [Viajes]
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
 *               id_material_concentrado:
 *                 type: integer
 *               total_concentrado_humedo:
 *                 type: number
 *     responses:
 *       201:
 *         description: Línea de viaje asignada
 */
router.post('/:id/lineas', viajesController.asignarLinea);

/**
 * @swagger
 * /material/viajes/{idViaje}/lineas/{idLinea}:
 *   delete:
 *     summary: Eliminar una línea de un viaje (devuelve stock al lote)
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: idViaje
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: idLinea
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Línea eliminada
 */
router.delete('/:idViaje/lineas/:idLinea', viajesController.eliminarLinea);

export default router;
