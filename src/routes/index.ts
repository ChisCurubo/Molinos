import { Router } from 'express';
import authRoutes    from './auth/routes.auth';
import nominaRoutes  from './nomina/routes.nomina';
import pagosRoutes   from './pagos/routes.pagos';
import materialRoutes from './material/routes.material';
import infoRoutes    from './info/routes.info';
import inventarioProductosRoutes from './inventario_productos/routes.inventario_productos';
import { auditoria } from '../helpers/auditoria.middleware';
import archivosRoutes from './archivos/routes.archivos';
import healthRoutes from './health.routes';
import { authMiddleware, requireAccess, requireRole } from '../helpers/auth.middleware';

const router = Router();
router.use(auditoria);

// Rutas públicas (login, forgot, reset)
router.use('/auth', authRoutes);
router.use('/health', healthRoutes); // público: healthcheck de Docker/Caddy

// Roles: 1 admin, 2 financiero(Juliana), 3 materiales(Vicky), 4 Valeria, 5 Ginna, 6 importaciones(Angela), 7 Cindy
// Roles 4 (Valeria), 5 (Ginna) y 7 (Cindy): SIN acceso a ningún módulo por decisión del usuario. chris (super admin) pasa siempre.
const MAT = requireAccess({ write: [3], read: [1] });
const FIN = requireAccess({ write: [2, 6], read: [1] });
const FINMAT = requireAccess({ write: [2, 3, 6], read: [1] }); // pagos de material, flete, agua, mulas y combustible
const MATPAGOS = ['/material', '/flete', '/agua', '/mulas', '/combustible'];
const pagosAccess = (req: any, res: any, next: any) =>
    (MATPAGOS.some(p => req.path === p || req.path.startsWith(p + '/')) ? FINMAT : FIN)(req, res, next);

router.use('/material', authMiddleware, MAT, materialRoutes);
router.use('/nomina',   authMiddleware, requireAccess({ write: [2, 6], read: [1] }), nominaRoutes);
router.use('/pagos',    authMiddleware, pagosAccess, pagosRoutes);
router.use('/archivos', authMiddleware, requireRole([1, 2, 3, 6]), archivosRoutes);
router.use('/info',     authMiddleware, requireRole([1, 2, 3, 6]), infoRoutes);
router.use('/inventario-productos', authMiddleware, requireAccess({ write: [3], read: [1, 2, 6] }), inventarioProductosRoutes);

export default router;
