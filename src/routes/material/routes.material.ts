import { Router } from 'express';
import analisisRoutes from './analisis.routes';
import minaRoutes from './mina.routes';
import proveedorRoutes from './proveedor.routes';
import tarifaCalculoRoutes from './tarifa_calculo.routes';
import volquetaRoutes from './volqueta.routes';
import materialRoutes from './material.routes';
import aguaRoutes from './agua.routes';

const router = Router();

router.use('/analisis', analisisRoutes);
router.use('/mina', minaRoutes);
router.use('/proveedor', proveedorRoutes);
router.use('/tarifa-calculo', tarifaCalculoRoutes);
router.use('/volqueta', volquetaRoutes);
router.use('/agua', aguaRoutes);
router.use('/', materialRoutes);

export default router;
