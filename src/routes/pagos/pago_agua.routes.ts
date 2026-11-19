import { Router } from 'express';
import { factory } from '../../config/factory';

import { upComprobante } from '../../helpers/upload.middleware';
import { validarDinero } from '../../helpers/validar.middleware';
const router = Router();
const c = factory.pagos.getPagoAguaController();

// Abonos (rutas específicas primero)
router.get('/abonos', c.listarAbonos);
router.patch('/abonos/:idAbono', upComprobante, validarDinero, c.actualizarAbono);
router.delete('/abonos/:idAbono', c.eliminarAbono);

// Dashboard y estado de cuenta por dueño
router.get('/deuda', c.deuda);
router.get('/dueno/:id', c.estadoCuenta);
router.post('/dueno/:id/abonos', upComprobante, validarDinero, c.registrarAbono);

export default router;
