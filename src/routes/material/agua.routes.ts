import { Router } from 'express';
import { AguaPlantaController } from '../../controllers/material/agua.controller';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.material.getAguaPlantaController();

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
 *               id_vehiculo:
 *                 type: integer
 *                 example: 1
 *               fecha:
 *                 type: string
 *                 example: "2026-07-03"
 *               valor_viaje:
 *                 type: number
 *                 example: 50000
 *               cantidad_viajes:
 *                 type: number
 *                 example: 1
 *               acpm:
 *                 type: number
 *                 example: 0
 *               comprobante_url:
 *                 type: string
 *                 example: "https://ejemplo.com/recibo.png"
 *     responses:
 *       201:
 *         description: Viaje de agua registrado
 *           
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

/**
 * @swagger
 * /material/agua/dueno/{id_dueno}:
 *   get:
 *     summary: Obtener resumen y viajes de agua por dueño
 *     tags: [Agua Planta]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_dueno
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Resumen y lista de viajes del dueño
 */
router.get('/dueno/:id_dueno', controller.obtenerPorDueno);

/**
 * @swagger
 * /material/agua/{id}:
 *   put:
 *     summary: Actualizar un viaje de agua (recalcula valor total)
 *     tags: [Agua Planta]
 *     security:
 *       - bearerAuth: []
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
 *               valor_viaje:
 *                 type: number
 *                 description: Opcional
 *               cantidad_viajes:
 *                 type: number
 *                 description: Opcional
 *               acpm:
 *                 type: number
 *                 description: Opcional
 *               comprobante_url:
 *                 type: string
 *                 description: Opcional
 *     responses:
 *       200:
 *         description: Viaje de agua actualizado
 */
router.put('/:id', controller.actualizar);

export default router;
