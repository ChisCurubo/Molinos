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
 * /material/mina/tarifa-zona:
 *   get:
 *     summary: Listar tarifas de flete por zona (con historial)
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de tarifas por zona }
 *   post:
 *     summary: Crear una tarifa de flete para una zona (versiona la vigente si entra activa)
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_zona, valor_tonelada]
 *             properties:
 *               id_zona: { type: integer }
 *               valor_tonelada: { type: number, description: "Flete por tonelada (alias: tarifa)" }
 *               vigente_desde: { type: string, format: date, description: "Opcional; por defecto hoy" }
 *               vigente_hasta: { type: string, format: date, nullable: true }
 *               activo: { type: boolean, default: true }
 *     responses:
 *       201: { description: Tarifa creada }
 */
router.get('/tarifa-zona',        ctrl.listTarifasZona);
router.post('/tarifa-zona',       ctrl.createTarifaZona);

/**
 * @swagger
 * /material/mina/tarifa-zona/{id}:
 *   get:
 *     summary: Obtener una tarifa de zona por ID
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Detalle de la tarifa }
 *       404: { description: No encontrada }
 *   put:
 *     summary: Editar una tarifa de zona
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
 *               id_zona: { type: integer }
 *               valor_tonelada: { type: number, description: "alias: tarifa" }
 *               vigente_desde: { type: string, format: date }
 *               vigente_hasta: { type: string, format: date, nullable: true }
 *               activo: { type: boolean }
 *     responses:
 *       200: { description: Tarifa actualizada }
 *   delete:
 *     summary: Eliminar una tarifa de zona
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Tarifa eliminada }
 */
router.get('/tarifa-zona/:id',    ctrl.getTarifaZona);
router.put('/tarifa-zona/:id',    ctrl.updateTarifaZona);
router.delete('/tarifa-zona/:id', ctrl.deleteTarifaZona);

/**
 * @swagger
 * /material/mina/precio-material:
 *   get:
 *     summary: Listar precios de material (tabla de referencia)
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de precios de material }
 *   post:
 *     summary: Crear un precio de material (referencia)
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_minero: { type: integer, nullable: true }
 *               id_zona: { type: integer, nullable: true }
 *               metodo: { type: string, enum: [por_gramo, por_tonelada], default: por_tonelada }
 *               precio_por_gramo: { type: number, nullable: true }
 *               precio_por_tonelada: { type: number, nullable: true }
 *               intervalo_tenor_min: { type: number, default: 0 }
 *               intervalo_tenor_max: { type: number, default: 9999 }
 *               fecha_inicio: { type: string, format: date }
 *               fecha_fin: { type: string, format: date, nullable: true }
 *               activo: { type: boolean, default: true }
 *     responses:
 *       201: { description: Precio creado }
 */
router.get('/precio-material',        ctrl.listPreciosMaterial);
router.post('/precio-material',       ctrl.createPrecioMaterial);

/**
 * @swagger
 * /material/mina/precio-material/{id}:
 *   get:
 *     summary: Obtener un precio de material por ID
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Detalle del precio }
 *       404: { description: No encontrado }
 *   put:
 *     summary: Editar un precio de material
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Precio actualizado }
 *   delete:
 *     summary: Eliminar un precio de material
 *     tags: [Mina]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Precio eliminado }
 */
router.get('/precio-material/:id',    ctrl.getPrecioMaterial);
router.put('/precio-material/:id',    ctrl.updatePrecioMaterial);
router.delete('/precio-material/:id', ctrl.deletePrecioMaterial);

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
