import { Router } from 'express';
import { MinaController } from '../../controllers/material/mina.controller';
import { factory } from '../../config/factory';

const router = Router();
const ctrl = factory.material.getMinaController();

/**
 * @swagger
 * tags:
 *   name: Mina
 *   description: Gestión de minas, mineros y zonas
 */

/**
 * @swagger
 * /material/mina:
 *   get:
 *     summary: Listar todas las minas
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de minas
 */
router.get('/',                 ctrl.list);

/**
 * @swagger
 * /material/mina:
 *   post:
 *     summary: Crear una mina
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               id_minero:
 *                 type: integer
 *               id_zona:
 *                 type: integer
 *               ubicacion:
 *                 type: string
 *               estado:
 *                 type: string
 *     responses:
 *       201:
 *         description: Mina creada
 */
router.post('/',                ctrl.create);
router.put('/:id',              ctrl.update);
router.delete('/:id',           ctrl.delete);

/**
 * @swagger
 * /material/catalogo/mineros:
 *   get:
 *     summary: Catálogo de mineros activos
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de mineros
 */
router.get('/catalogo/mineros', ctrl.mineros);

/**
 * @swagger
 * /material/mina/minero:
 *   post:
 *     summary: Crear un minero
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               alias:
 *                 type: string
 *               metodo_calculo:
 *                 type: string
 *                 example: "por_gramo"
 *     responses:
 *       201:
 *         description: Minero creado
 */
router.post('/minero',          ctrl.createMinero);
router.put('/minero/:id',       ctrl.updateMinero);
router.delete('/minero/:id',    ctrl.deleteMinero);

/**
 * @swagger
 * /material/catalogo/zonas:
 *   get:
 *     summary: Catálogo de zonas y tarifas
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de zonas
 */
router.get('/catalogo/zonas',   ctrl.zonas);

/**
 * @swagger
 * /material/mina/zona:
 *   post:
 *     summary: Crear una zona
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *     responses:
 *       201:
 *         description: Zona creada
 */
router.post('/zona',            ctrl.createZona);
router.put('/zona/:id',         ctrl.updateZona);
router.delete('/zona/:id',      ctrl.deleteZona);

/**
 * @swagger
 * /material/mina/{id}:
 *   get:
 *     summary: Obtener detalle de mina por ID
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle de la mina
 */
router.get('/:id',              ctrl.getById);

/**
 * @swagger
 * /material/mina/{id}/entradas:
 *   get:
 *     summary: Entradas históricas de una mina
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/:id/entradas',     ctrl.entradas);

/**
 * @swagger
 * /material/mina/{id}/resumen:
 *   get:
 *     summary: Resumen estadístico de una mina
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Resumen estadístico
 */
router.get('/:id/resumen',      ctrl.resumen);

export default router;
