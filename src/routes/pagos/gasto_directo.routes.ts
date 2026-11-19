import { Router } from 'express';
import { factory } from '../../config/factory';

import { upComprobante } from '../../helpers/upload.middleware';
import { validarDinero } from '../../helpers/validar.middleware';
const router = Router();
const c = factory.pagos.getGastoDirectoController();

// Gasto Directo: todo gasto que se paga de inmediato (parqueadero, peajes, etc.) se registra
// como su propia Cuenta_Por_Pagar ya pagada (CxP + abono en el mismo paso), con comprobante
// obligatorio — sin saldo de caja física que rastrear (decisión 2026-10-22, reemplaza Caja Menor).
router.get('/', c.listar);
router.post('/', upComprobante, validarDinero, c.registrar);
router.get('/:id', c.obtenerPorId);
router.patch('/:id', upComprobante, validarDinero, c.editar);
router.delete('/:id', c.anular);

export default router;
