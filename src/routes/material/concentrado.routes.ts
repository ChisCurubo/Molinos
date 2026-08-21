import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const concentradoController = factory.material.getConcentradoController();

/**
 * @swagger
 * /material/concentrado/resumen:
 *   get:
 *     summary: KPIs de procesamiento (conteo de lotes por estado + toneladas disponibles)
 *     tags: [Procesamiento]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Resumen }
 */
router.get('/resumen', concentradoController.resumen);

/**
 * @swagger
 * /material/concentrado/procesamiento:
 *   get:
 *     summary: Materiales vinculados a lotes (lista plana con análisis embebidos)
 *     tags: [Procesamiento]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: id_lote, schema: { type: integer } }
 *       - { in: query, name: codigo_lote, schema: { type: string } }
 *       - { in: query, name: id_mina, schema: { type: integer } }
 *       - { in: query, name: desde, schema: { type: string } }
 *       - { in: query, name: hasta, schema: { type: string } }
 *       - { in: query, name: estado_lote, schema: { type: string } }
 *     responses:
 *       200: { description: Lista de materiales procesados }
 */
router.get('/procesamiento', concentradoController.listarProcesamiento);

/**
 * @swagger
 * /material/concentrado:
 *   get:
 *     summary: Listar lotes de concentrado (todos los estados) con filtros
 *     tags: [Procesamiento]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: codigo, schema: { type: string } }
 *       - { in: query, name: estado, schema: { type: string } }
 *       - { in: query, name: desde, schema: { type: string } }
 *       - { in: query, name: hasta, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: offset, schema: { type: integer } }
 *     responses:
 *       200: { description: Lista de lotes }
 */
router.get('/', concentradoController.listar);

/**
 * @swagger
 * /material/concentrado/{id}:
 *   get:
 *     summary: Detalle de un lote + materiales vinculados + análisis
 *     tags: [Procesamiento]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Detalle del lote }
 *       404: { description: Lote no encontrado }
 */
router.get('/:id', concentradoController.obtenerDetalle);

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

/**
 * @swagger
 * /material/concentrado/{id}:
 *   put:
 *     summary: Editar campos básicos de un lote (código, procesos, ubicación, etc.)
 *     tags: [Procesamiento]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Lote actualizado }
 */
router.put('/:id', concentradoController.editarLote);

/**
 * @swagger
 * /material/concentrado/{id}/material/{idEntrada}:
 *   delete:
 *     summary: Desvincular un material (entrada) de un lote en proceso (devuelve stock)
 *     tags: [Procesamiento]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: idEntrada
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Material desvinculado }
 *       409: { description: El lote no está en proceso }
 */
router.delete('/:id/material/:idEntrada', concentradoController.desvincularMaterial);

/**
 * @swagger
 * /material/concentrado/{id}:
 *   delete:
 *     summary: Eliminar un lote en proceso (devuelve todo el material y borra sus análisis)
 *     tags: [Procesamiento]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Lote eliminado }
 *       409: { description: Lote cerrado o ya incluido en viajes }
 */
router.delete('/:id', concentradoController.eliminarLote);

export default router;
