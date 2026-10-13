import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.nomina.getNominaLiquidacionController();

/**
 * @swagger
 * tags:
 *   name: NominaLiquidaciones
 *   description: Liquidación quincenal de nómina (fijos y variables)
 */

/**
 * @swagger
 * /nomina/empleados/liquidaciones/preview:
 *   get:
 *     summary: Previsualizar el cálculo de una liquidación quincenal (no persiste nada)
 *     tags: [NominaLiquidaciones]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: id_empleado
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: anio
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: mes
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: quincena
 *         required: true
 *         schema: { type: integer, enum: [1, 2] }
 *     responses:
 *       200:
 *         description: Cálculo de la liquidación (bruto, bonos del período, descuento de préstamo, aportes de salud/pensión, neto)
 */
router.get('/liquidaciones/preview', controller.previsualizar);

/**
 * @swagger
 * /nomina/empleados/liquidaciones/preview-grupal:
 *   get:
 *     summary: Previsualizar el cálculo de la liquidación de todos los empleados en una quincena (no persiste nada)
 *     tags: [NominaLiquidaciones]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: anio
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: mes
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: quincena
 *         required: true
 *         schema: { type: integer, enum: [1, 2] }
 *     responses:
 *       200:
 *         description: Lista de previews (uno por empleado) y de errores puntuales por empleado
 */
router.get('/liquidaciones/preview-grupal', controller.previsualizarGrupal);

/**
 * @swagger
 * /nomina/empleados/liquidaciones:
 *   post:
 *     summary: Confirmar la liquidación de una quincena (genera la CxP de Nómina y descuenta cuotas de préstamos activos)
 *     tags: [NominaLiquidaciones]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_empleado: { type: integer }
 *               anio: { type: integer }
 *               mes: { type: integer }
 *               quincena: { type: integer, enum: [1, 2] }
 *               otros_descuentos: { type: number }
 *     responses:
 *       201:
 *         description: Liquidación confirmada
 *       409:
 *         description: Ya existe una liquidación para esa quincena
 */
router.post('/liquidaciones', controller.confirmar);

/**
 * @swagger
 * /nomina/empleados/liquidaciones/borrador:
 *   post:
 *     summary: Crear un borrador editable (estado='borrador', no genera CxP ni descuenta préstamos)
 *     tags: [NominaLiquidaciones]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_empleado: { type: integer }
 *               anio: { type: integer }
 *               mes: { type: integer }
 *               quincena: { type: integer, enum: [1, 2] }
 *               otros_descuentos: { type: number }
 *     responses:
 *       201:
 *         description: Borrador creado
 *       409:
 *         description: Ya existe una liquidación (borrador o confirmada) para esa quincena
 */
router.post('/liquidaciones/borrador', controller.crearBorrador);

/**
 * @swagger
 * /nomina/empleados/liquidaciones:
 *   get:
 *     summary: Listar liquidaciones (filtrable por empleado, año, mes)
 *     tags: [NominaLiquidaciones]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: id_empleado
 *         schema: { type: integer }
 *       - in: query
 *         name: anio
 *         schema: { type: integer }
 *       - in: query
 *         name: mes
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Historial de liquidaciones
 */
router.get('/liquidaciones', controller.listar);

/**
 * @swagger
 * /nomina/empleados/liquidaciones/{id}:
 *   get:
 *     summary: Obtener una liquidación por id
 *     tags: [NominaLiquidaciones]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Liquidación encontrada }
 *       404: { description: No encontrada }
 */
router.get('/liquidaciones/:id', controller.obtenerPorId);

/**
 * @swagger
 * /nomina/empleados/liquidaciones/{id}:
 *   patch:
 *     summary: Editar otros_descuentos de un borrador (409 si ya está confirmado)
 *     tags: [NominaLiquidaciones]
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
 *               otros_descuentos: { type: number }
 *     responses:
 *       200:
 *         description: Borrador actualizado (monto_neto recalculado)
 *       409:
 *         description: La liquidación ya fue confirmada
 */
router.patch('/liquidaciones/:id', controller.actualizarBorrador);

/**
 * @swagger
 * /nomina/empleados/liquidaciones/{id}/confirmar:
 *   post:
 *     summary: Promover un borrador a confirmado — genera la CxP de Nómina y descuenta cuotas de préstamos activos
 *     tags: [NominaLiquidaciones]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Liquidación confirmada
 *       409:
 *         description: La liquidación ya estaba confirmada
 */
router.post('/liquidaciones/:id/confirmar', controller.confirmarBorrador);

export default router;
