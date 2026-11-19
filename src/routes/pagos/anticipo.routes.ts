import { Router } from 'express';
import { factory } from '../../config/factory';

import { upComprobante } from '../../helpers/upload.middleware';
import { validarDinero } from '../../helpers/validar.middleware';
const router = Router();
const c = factory.pagos.getAnticipoController();

router.get('/', c.listar);
router.get('/:id', c.detalle);
router.post('/', upComprobante, validarDinero, c.crear);
router.delete('/:id', c.anular);

export default router;
