import { Router } from 'express';

// Sub-rutas
import cxpRoutes from './cxp.routes';
import cxcRoutes from './cxc.routes';
import gastoRoutes from './gasto.routes';
import alquilerRoutes from './alquiler.routes';
import proveedorRoutes from './proveedor.routes';

const router = Router();

router.use('/cxp', cxpRoutes);
router.use('/cxc', cxcRoutes);
router.use('/gastos', gastoRoutes);
router.use('/alquileres', alquilerRoutes);
router.use('/proveedores', proveedorRoutes);

export default router;
