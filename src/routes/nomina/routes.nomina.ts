import { Router } from 'express';

// Sub-rutas
import empleadoRoutes from './empleado.routes';
import turnoRoutes from './turno.routes';
import plantaRoutes from './planta.routes';

const router = Router();

router.use('/empleados', empleadoRoutes);
router.use('/turnos', turnoRoutes);
router.use('/plantas', plantaRoutes);

export default router;
