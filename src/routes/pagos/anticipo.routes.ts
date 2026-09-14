import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const c = factory.pagos.getAnticipoController();

router.get('/', c.listar);
router.get('/:id', c.detalle);
router.post('/', c.crear);
router.delete('/:id', c.anular);

export default router;
