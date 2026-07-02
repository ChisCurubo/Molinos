import { Router } from 'express';
import { AguaPlantaController } from '../../controllers/material/agua.controller';

const router = Router();
const controller = new AguaPlantaController();

/**
 * @swagger
 * tags:
 *   name: Agua Planta
 *   description: Gestión del abastecimiento de agua a la planta
 */

/**
 * @swagger
 * /material/agua:
 *   post:
 *     summary: Registrar un nuevo viaje de agua
 *     tags: [Agua Planta]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_dueno_volqueta:
 *                 type: integer
 *                 example: 2
 *               placa:
 *                 type: string
 *                 example: "XYZ-123"
 *               nombre_conductor:
 *                 type: string
 *                 example: "Nelson"
 *               valor_viaje:
 *                 type: number
 *                 example: 50000
 *               comentarios:
 *                 type: string
 *                 example: "Viaje de agua para proceso"
 *     responses:
 *       201:
 *         description: Viaje de agua registrado
 */
router.post('/', controller.registrar);

/**
 * @swagger
 * /material/agua/viajes:
 *   get:
 *     summary: Listar todos los viajes de agua registrados
 *     tags: [Agua Planta]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista detallada de viajes
 */
router.get('/viajes', controller.listar);

/**
 * @swagger
 * /material/agua/resumen:
 *   get:
 *     summary: Obtener resumen agrupado por dueño de volqueta
 *     tags: [Agua Planta]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Totales de viajes y dinero adeudado por dueño
 */
router.get('/resumen', controller.resumenPorDueno);

export default router;
