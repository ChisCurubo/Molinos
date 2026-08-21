import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const viajesController = factory.material.getViajesController();

/**
 * @swagger
 * /material/viajes/resumen:
 *   get:
 *     summary: KPIs de viajes del período
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: desde, schema: { type: string } }
 *       - { in: query, name: hasta, schema: { type: string } }
 *     responses:
 *       200: { description: Resumen }
 */
router.get('/resumen', viajesController.resumen);

/**
 * @swagger
 * /material/viajes/lote/{id}:
 *   get:
 *     summary: Trazabilidad — en qué viajes salió un lote y cuánto metal llevó
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Líneas del lote con su viaje }
 */
router.get('/lote/:id', viajesController.trazabilidadLote);

/**
 * @swagger
 * /material/viajes/linea/{id_linea}/trazabilidad:
 *   get:
 *     summary: Trazabilidad desde una línea de viaje → su lote → materiales de origen
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id_linea, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Línea con su lote y los materiales que lo compusieron }
 *       404: { description: Línea no encontrada }
 */
router.get('/linea/:id_linea/trazabilidad', viajesController.trazabilidadLinea);

/**
 * @swagger
 * /material/viajes/{id}/trazabilidad:
 *   get:
 *     summary: Trazabilidad completa de un viaje → sus lotes → materiales de origen
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Viaje con sus líneas/lotes y el aporte de cada material }
 *       404: { description: Viaje no encontrado }
 */
router.get('/:id/trazabilidad', viajesController.trazabilidadViaje);

/**
 * @swagger
 * /material/viajes:
 *   get:
 *     summary: Listar viajes (con filtros, líneas embebidas y agregados)
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: desde, schema: { type: string } }
 *       - { in: query, name: hasta, schema: { type: string } }
 *       - { in: query, name: numero_viaje, schema: { type: string } }
 *       - { in: query, name: id_lote, schema: { type: integer } }
 *       - { in: query, name: codigo_lote, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: offset, schema: { type: integer } }
 *     responses:
 *       200: { description: Lista de viajes }
 */
router.get('/', viajesController.listar);

/**
 * @swagger
 * /material/viajes/{id}:
 *   get:
 *     summary: Detalle de un viaje (con líneas completas)
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Detalle del viaje }
 *       404: { description: Viaje no encontrado }
 */
router.get('/:id', viajesController.obtenerDetalle);

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

/**
 * @swagger
 * /material/viajes/{id}:
 *   delete:
 *     summary: Eliminar un viaje completo (borra sus líneas y devuelve stock a los lotes)
 *     tags: [Viajes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Viaje eliminado
 */
router.delete('/:id', viajesController.eliminarViaje);

export default router;
