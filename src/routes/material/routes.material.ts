import { Router } from 'express';
import analisisRoutes from './analisis.routes';
import minaRoutes from './mina.routes';
import proveedorRoutes from './proveedor.routes';
import tarifaCalculoRoutes from './tarifa_calculo.routes';
import volquetaRoutes from './volqueta.routes';
import materialRoutes from './material.routes';
import aguaRoutes from './agua.routes';
import vistasRoutes from './vistas.material.routes';
import concentradoRoutes from './concentrado.routes';
import viajesRoutes from './viajes.routes';
import inventarioRoutes from './inventario.routes';

const router = Router();

router.use('/analisis', analisisRoutes);
router.use('/mina', minaRoutes);
router.use('/catalogo/mineros', minaRoutes);
router.use('/proveedor', proveedorRoutes);
router.use('/tarifa-calculo', tarifaCalculoRoutes);
router.use('/volqueta', volquetaRoutes);
router.use('/agua', aguaRoutes);
router.use('/vistas', vistasRoutes);
router.use('/concentrado', concentradoRoutes);
router.use('/viajes', viajesRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/', materialRoutes);

export default router;
