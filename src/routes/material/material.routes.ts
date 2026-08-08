import { Router } from 'express';
import { MaterialEntradaController, PrecioMaterialController } from '../../controllers/material/material.controller';
import { factory } from '../../config/factory';

const router = Router();
const materialController = factory.material.getMaterialEntradaController();
const precioController = factory.material.getPrecioMaterialController();

// === Rutas específicas (deben ir antes de /:id) ===
/**
 * @swagger
 * /material/entradas/pendientes-analisis:
 *   get:
 *     summary: Entradas sin análisis completado
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/entradas/pendientes-analisis',     materialController.pendientesLaboratorio);

/**
 * @swagger
 * /material/entradas/stats:
 *   get:
 *     summary: KPIs del tablero de entradas
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: total_registros, sin_procesar, ton_humedo_pendiente, volquetas_activas
 */
router.get('/entradas/stats',                   materialController.stats);

/**
 * @swagger
 * /material/entradas/minero/{id_minero}:
 *   get:
 *     summary: Entradas de un minero
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_minero
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/entradas/minero/:id_minero',       materialController.listarPorMinero);

/**
 * @swagger
 * /material/entradas/mina/{id_mina}:
 *   get:
 *     summary: Entradas de una mina
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_mina
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/entradas/mina/:id_mina',           materialController.listarPorMina);

/**
 * @swagger
 * /material/entradas/vehiculo/{id_vehiculo}:
 *   get:
 *     summary: Entradas de un vehículo
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_vehiculo
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/entradas/vehiculo/:id_vehiculo',   materialController.listarPorVehiculo);

/**
 * @swagger
 * /material/entradas/dueno/{id_dueno}:
 *   get:
 *     summary: Entradas del dueño de vehículo
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id_dueno
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/entradas/dueno/:id_dueno',         materialController.listarPorDueno);

/**
 * @swagger
 * /material/entradas/fecha/{fecha}:
 *   get:
 *     summary: Entradas en una fecha
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/entradas/fecha/:fecha',            materialController.listarPorFecha);

/**
 * @swagger
 * /material/entradas/{id}:
 *   get:
 *     summary: Obtener entrada por ID
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalle de entrada
 */
router.get('/entradas/:id',                     materialController.getById);

/**
 * @swagger
 * /material/entradas/{id}:
 *   put:
 *     summary: Editar entrada (recalcula el flete si cambia peso o mina)
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Entrada actualizada
 */
router.put('/entradas/:id',                     materialController.actualizar);

/**
 * @swagger
 * /material/entradas/{id}:
 *   delete:
 *     summary: Eliminar entrada (solo si estado='pendiente' y sin análisis)
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Entrada eliminada
 *       409:
 *         description: No se puede eliminar (estado o análisis)
 */
router.delete('/entradas/:id',                  materialController.eliminar);

/**
 * @swagger
 * /material/entradas/{id}/estado:
 *   patch:
 *     summary: Cambiar estado
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/entradas/:id/estado',            materialController.cambiarEstado);

/**
 * @swagger
 * /material/entradas/{id}/cancelar:
 *   patch:
 *     summary: Cancelar entrada
 *     tags: [Material]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Entrada cancelada
 */
router.patch('/entradas/:id/cancelar',          materialController.cancelar);

/**
 * @swagger
 * tags:
 *   name: Material
 *   description: Gestión de llegadas de volquetas y entradas de material a planta
 */

/**
 * @swagger
 * /material/entrada:
 *   post:
 *     summary: Registrar llegada de una volqueta a la planta (Fase 1)
 *     tags: [Material]
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
 *               numero_volqueta:
 *                 type: string
 *                 example: "V-001"
 *               id_mina:
 *                 type: integer
 *                 example: 1
 *               id_tipo_material:
 *                 type: integer
 *                 example: 1
 *               peso_llegada_planta:
 *                 type: number
 *                 example: 12000.5
 *     responses:
 *       201:
 *         description: Entrada registrada exitosamente
 */
router.post('/entrada', materialController.registrarLlegada);

/**
 * @swagger
 * /material/entradas:
 *   get:
 *     summary: Listar todas las entradas registradas (con filtros opcionales)
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fechaDesde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicio (ej. 2026-01-01)
 *       - in: query
 *         name: fechaHasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha fin (ej. 2026-12-31)
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *         description: Estado (ej. 'PENDIENTE')
 *     responses:
 *       200:
 *         description: Lista de entradas
 */
router.get('/entradas', materialController.listarEntradas);

/**
 * @swagger
 * /material/pendientes:
 *   get:
 *     summary: Listar entradas pendientes de análisis de laboratorio
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Entradas sin tenor ni humedad asignada
 */
router.get('/pendientes', materialController.pendientesLaboratorio);

/**
 * @swagger
 * /material/precio/calcular:
 *   get:
 *     summary: Simular cálculo del precio aplicable según los parámetros dados
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: idMinero
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID del Minero
 *       - in: query
 *         name: metodo
 *         schema:
 *           type: string
 *         required: true
 *         description: Método de cálculo (ej. 'por_gramo')
 *       - in: query
 *         name: tenorFalso
 *         schema:
 *           type: number
 *         required: true
 *         description: Tenor Falso
 *       - in: query
 *         name: fechaEntrada
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: Fecha de llegada a planta (ej. 2026-06-30)
 *     responses:
 *       200:
 *         description: Detalles de la regla de precio aplicada
 */
router.get('/precio/calcular', precioController.buscarPrecio);

/**
 * @swagger
 * /material/precios/lote:
 *   post:
 *     summary: Registrar tarifas por lotes (intervalos de precios)
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_minero:
 *                 type: integer
 *               metodo:
 *                 type: string
 *               fecha_inicio:
 *                 type: string
 *               intervalos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     min:
 *                       type: number
 *                     max:
 *                       type: number
 *                     precio_por_gramo:
 *                       type: number
 *                     precio_por_tonelada:
 *                       type: number
 *     responses:
 *       201:
 *         description: Tarifas registradas
 */
/**
 * @swagger
 * /material/precios:
 *   get:
 *     summary: Listar precios de material (con filtros)
 *     tags: [Material]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id_minero
 *         schema: { type: integer }
 *         description: Filtra por minero (precios específicos de ese minero)
 *       - in: query
 *         name: id_zona
 *         schema: { type: integer }
 *         description: Filtra por zona
 *       - in: query
 *         name: alcance
 *         schema: { type: string, enum: [general] }
 *         description: "alcance=general → solo precios sin minero ni zona"
 *       - in: query
 *         name: activo
 *         schema: { type: boolean }
 *         description: Filtra por activo (true/false)
 *     responses:
 *       200:
 *         description: Lista de precios con su alcance (minero | zona | general)
 */
router.get('/precios', precioController.listar);

router.post('/precios/lote', precioController.insertarLote);

/**
 * @swagger
 * /material/precios/{id}:
 *   put:
 *     summary: Editar un intervalo de precio (desactiva el actual e inserta el reemplazo activo)
 *     tags: [Material]
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
 *               min:
 *                 type: number
 *               max:
 *                 type: number
 *               precio_por_gramo:
 *                 type: number
 *               precio_por_tonelada:
 *                 type: number
 *     responses:
 *       200:
 *         description: Intervalo reemplazado (nuevo id activo)
 */
router.put('/precios/:id', precioController.reemplazarIntervalo);

export default router;
