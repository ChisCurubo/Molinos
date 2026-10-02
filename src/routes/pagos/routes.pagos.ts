import { Router } from 'express';
import { factory } from '../../config/factory';

// Sub-rutas
import cxpRoutes from './cxp.routes';
import cxcRoutes from './cxc.routes';
import gastoRoutes from './gasto.routes';
import alquilerRoutes from './alquiler.routes';
import proveedorRoutes from './proveedor.routes';
import prestamoFinancieroRoutes from './prestamo_financiero.routes';
import pagoMaterialRoutes from './pago_material.routes';
import pagoFleteRoutes from './pago_flete.routes';
import pagoAguaRoutes from './pago_agua.routes';
import combustibleRoutes from './combustible.routes';
import anticipoRoutes from './anticipo.routes';
import pagoMulaRoutes from './pago_mula.routes';
import vistasRoutes from './vistas.pagos.routes';
import ingresoTesoreriaRoutes from './ingreso_tesoreria.routes';
import flujoCajaRoutes from './flujo_caja.routes';

const router = Router();

router.use('/cxp', cxpRoutes);
router.use('/material', pagoMaterialRoutes);
router.use('/flete', pagoFleteRoutes);
router.use('/agua', pagoAguaRoutes);
router.use('/cxc', cxcRoutes);
router.use('/gastos', gastoRoutes);
router.use('/alquileres', alquilerRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/prestamos-financieros', prestamoFinancieroRoutes);
router.use('/combustible', combustibleRoutes);
router.use('/anticipos', anticipoRoutes);
router.use('/mulas', pagoMulaRoutes);
router.use('/ingresos', ingresoTesoreriaRoutes);

/**
 * @swagger
 * /pagos/categorias-ingreso:
 *   get:
 *     summary: Catálogo de categorías de Ingresos_Tesoreria (selector para el front)
 *     tags: [Tesorería]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de categorías de ingreso }
 */
router.get('/categorias-ingreso', factory.pagos.getIngresoTesoreriaController().listarCategorias);

router.use('/', flujoCajaRoutes);
router.use('/', vistasRoutes);

export default router;
