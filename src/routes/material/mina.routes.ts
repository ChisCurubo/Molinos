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

/**
 * @swagger
 * /material/mina/{id}:
 *   put:
 *     summary: Actualizar una mina (parcial; solo columnas reales)
 *     tags: [Mina]
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
 *               nombre: { type: string }
 *               id_minero: { type: integer }
 *               id_zona: { type: integer }
 *               ubicacion: { type: string }
 *               estado: { type: string }
 *     responses:
 *       200: { description: Mina actualizada }
 *   delete:
 *     summary: Eliminar una mina
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Mina eliminada }
 */
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
 * /material/mina/catalogo/mineros-con-minas:
 *   get:
 *     summary: Catálogo de mineros con sus minas anidadas
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de mineros, cada uno con su arreglo `minas`
 */
router.get('/catalogo/mineros-con-minas', ctrl.minerosConMinas);

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

/**
 * @swagger
 * /material/mina/minero/{id}:
 *   put:
 *     summary: Actualizar un minero
 *     tags: [Mina]
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
 *               nombre: { type: string }
 *               alias: { type: string }
 *               metodo_calculo: { type: string, example: "por_gramo" }
 *               estado: { type: string }
 *     responses:
 *       200: { description: Minero actualizado }
 *   delete:
 *     summary: Eliminar un minero
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Minero eliminado }
 */
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
 *               valor_tonelada:
 *                 type: number
 *                 description: "Tarifa de flete inicial (alias aceptado: tarifa)"
 *     responses:
 *       201:
 *         description: Zona creada
 */
router.post('/zona',            ctrl.createZona);

/**
 * @swagger
 * /material/mina/zona/{id}:
 *   put:
 *     summary: Actualizar una zona (acepta tarifa | valor_tonelada; versiona el flete)
 *     tags: [Mina]
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
 *               nombre: { type: string }
 *               descripcion: { type: string }
 *               valor_tonelada: { type: number, description: "Tarifa de flete (alias: tarifa)" }
 *     responses:
 *       200: { description: Zona actualizada }
 *   delete:
 *     summary: Eliminar zona y su historial de tarifas (409 si minas la usan)
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Zona eliminada }
 *       409: { description: "ZONA_EN_USO — hay minas usándola" }
 */
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
