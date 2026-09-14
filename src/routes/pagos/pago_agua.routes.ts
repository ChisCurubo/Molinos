import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const c = factory.pagos.getPagoAguaController();

// Abonos (rutas específicas primero)
router.get('/abonos', c.listarAbonos);
router.patch('/abonos/:idAbono', c.actualizarAbono);
router.delete('/abonos/:idAbono', c.eliminarAbono);

// Dashboard y estado de cuenta por dueño
router.get('/deuda', c.deuda);
router.get('/dueno/:id', c.estadoCuenta);
router.post('/dueno/:id/abonos', c.registrarAbono);

export default router;
