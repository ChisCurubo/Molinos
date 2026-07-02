import { Router } from 'express';
import authRoutes from './auth/routes.auth';
import nominaRoutes from './nomina/routes.nomina';
import pagosRoutes from './pagos/routes.pagos';
import materialRoutes from './material/routes.material';

const router = Router();

router.use('/auth', authRoutes);
router.use('/nomina', nominaRoutes);
router.use('/pagos', pagosRoutes);
router.use('/material', materialRoutes);

export default router;
