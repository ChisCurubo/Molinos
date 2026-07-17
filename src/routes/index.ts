import { Router } from 'express';
import authRoutes    from './auth/routes.auth';
import nominaRoutes  from './nomina/routes.nomina';
import pagosRoutes   from './pagos/routes.pagos';
import materialRoutes from './material/routes.material';
import infoRoutes    from './info/routes.info';
import { authMiddleware } from '../helpers/auth.middleware';

const router = Router();

// Rutas públicas (login, forgot, reset)
router.use('/auth', authRoutes);

// Rutas protegidas con JWT
router.use('/material', authMiddleware, materialRoutes);
router.use('/nomina',   authMiddleware, nominaRoutes);
router.use('/pagos',    authMiddleware, pagosRoutes);
router.use('/info',     authMiddleware, infoRoutes);

export default router;
