import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const pc = factory.pagos.getPagoCombustibleController();

// Montado por combustible.routes.ts en '/pagos' → rutas finales bajo /pagos/combustible/pagos/...

// Abonos (rutas específicas primero)
router.get('/abonos', pc.listarAbonos);
router.patch('/abonos/:idAbono', pc.actualizarAbono);
router.delete('/abonos/:idAbono', pc.eliminarAbono);

// Dashboard y estado de cuenta por gasolinera
router.get('/deuda', pc.deuda);
router.get('/gasolinera/:id', pc.estadoCuenta);
router.post('/gasolinera/:id/abonos', pc.registrarAbono);

export default router;
