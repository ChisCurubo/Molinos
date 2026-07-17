import { Router } from 'express';
import { AnalisisController } from '../../controllers/material/analisis.controller';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.material.getAnalisisController();

/**
 * @swagger
 * tags:
 *   name: Análisis
 *   description: Gestión de análisis de laboratorio para las entradas de material
 */

/**
 * @swagger
 * /material/analisis:
 *   post:
 *     summary: Registrar resultado de análisis y disparar cálculos de precio/costo (Fases 2-5)
 *     tags: [Análisis]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_entrada:
 *                 type: integer
 *                 example: 1
 *               id_tipo_analisis:
 *                 type: integer
 *                 example: 1
 *               porcentaje_humedad:
 *                 type: number
 *                 example: 0.15
 *               toneladas_secas:
 *                 type: number
 *                 example: 10.2
 *               au_falso:
 *                 type: number
 *                 example: 15.5
 *     responses:
 *       201:
 *         description: Análisis registrado y cálculos finalizados
 */
router.post('/', controller.registrarAnalisis);

/**
 * @swagger
 * /material/analisis/entrada/{id_entrada}:
 *   get:
 *     summary: Obtener todos los análisis de una entrada
 *     tags: [Análisis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_entrada
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID de la entrada de material
 *     responses:
 *       200:
 *         description: Lista de análisis vinculados a la entrada
 */
// Rutas específicas primero
/**
 * @swagger
 * /material/analisis/minero/{id_minero}:
 *   get:
 *     summary: Análisis de un minero
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_minero
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de análisis
 */
router.get('/minero/:id_minero',             controller.listarPorMinero);

/**
 * @swagger
 * /material/analisis/mina/{id_mina}:
 *   get:
 *     summary: Análisis de una mina
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_mina
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de análisis
 */
router.get('/mina/:id_mina',                 controller.listarPorMina);

/**
 * @swagger
 * /material/analisis/fecha/{fecha}:
 *   get:
 *     summary: Análisis en una fecha
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de análisis
 */
router.get('/fecha/:fecha',                  controller.listarPorFecha);

/**
 * @swagger
 * /material/analisis/entrada/{id_entrada}/cabeza:
 *   get:
 *     summary: Análisis cabeza de una entrada
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_entrada
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Análisis cabeza
 */
router.get('/entrada/:id_entrada/cabeza',    controller.obtenerCabeza);

/**
 * @swagger
 * /material/analisis/entrada/{id_entrada}:
 *   get:
 *     summary: Todos los análisis de una entrada
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_entrada
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de análisis
 */
router.get('/entrada/:id_entrada',           controller.obtenerAnalisis);

/**
 * @swagger
 * /material/analisis/{id}:
 *   get:
 *     summary: Obtener análisis por ID
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle del análisis
 */
router.get('/:id',                           controller.getById);

/**
 * @swagger
 * /material/analisis/{id}:
 *   put:
 *     summary: Corregir análisis
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID numérico o número de análisis (ej. AN-999)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_entrada:
 *                 type: integer
 *                 description: (Opcional) ID de la nueva entrada si se desea mover el análisis
 *               porcentaje_humedad:
 *                 type: number
 *                 description: (Opcional) Porcentaje de humedad (ej. 20 o 0.20)
 *               au_falso:
 *                 type: number
 *                 description: (Opcional) Tenor falso de Au
 *               au_concentrado:
 *                 type: number
 *                 description: (Opcional) Au concentrado
 *               ag_concentrado:
 *                 type: number
 *                 description: (Opcional) Ag concentrada
 *     responses:
 *       200:
 *         description: Análisis actualizado exitosamente
 */
router.put('/:id',                           controller.actualizarAnalisis);

/**
 * @swagger
 * /material/analisis/{id}/valor:
 *   patch:
 *     summary: Actualizar valor del análisis
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Valor actualizado
 */
router.patch('/:id/valor',                    controller.agregarValor);

/**
 * @swagger
 * /material/analisis/{id}/pago:
 *   patch:
 *     summary: Marcar pago de análisis
 *     tags: [Análisis]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado de pago actualizado
 */
router.patch('/:id/pago',                    controller.marcarPago);

export default router;
