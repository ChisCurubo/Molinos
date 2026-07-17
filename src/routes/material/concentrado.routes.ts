import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const concentradoController = factory.material.getConcentradoController();

/**
 * @swagger
 * /material/concentrado:
 *   post:
 *     summary: Iniciar un nuevo lote de concentrado
 *     tags: [Procesamiento]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               codigo:
 *                 type: string
 *               fecha_inicio:
 *                 type: string
 *     responses:
 *       201:
 *         description: Lote iniciado
 */
router.post('/', concentradoController.iniciarLote);

/**
 * @swagger
 * /material/concentrado/{id}/procesar:
 *   post:
 *     summary: Agregar material (materia prima) al molino para el lote
 *     tags: [Procesamiento]
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
 *               id_entrada:
 *                 type: integer
 *               toneladas_aportadas:
 *                 type: number
 *     responses:
 *       201:
 *         description: Material agregado
 */
router.post('/:id/procesar', concentradoController.procesarMaterial);

/**
 * @swagger
 * /material/concentrado/{id}/cerrar:
 *   put:
 *     summary: Cerrar el lote y enviarlo a canoa
 *     tags: [Procesamiento]
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
 *               toneladas_humedo:
 *                 type: number
 *               porcentaje_humedad:
 *                 type: number
 *               fecha_fin:
 *                 type: string
 *               hizo_molienda:
 *                 type: integer
 *               hizo_filtroprensa:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Lote cerrado
 */
router.put('/:id/cerrar', concentradoController.cerrarLote);

export default router;
