import { Router } from 'express';

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
router.use('/', vistasRoutes);

export default router;
