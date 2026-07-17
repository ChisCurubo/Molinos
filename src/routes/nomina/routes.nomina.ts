import { Router } from 'express';

// Sub-rutas
import empleadoRoutes from './empleado.routes';
import turnoRoutes from './turno.routes';
import plantaRoutes from './planta.routes';
import vistasRoutes from './vistas.nomina.routes';

const router = Router();

router.use('/empleados', empleadoRoutes);
router.use('/turnos', turnoRoutes);
router.use('/plantas', plantaRoutes);
router.use('/vistas', vistasRoutes);

export default router;
