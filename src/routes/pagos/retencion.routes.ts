import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.pagos.getRetencionController();

router.get('/', controller.list);
router.get('/aplicadas', controller.listarAplicados);
router.patch('/aplicadas/:id', controller.ajustar);

export default router;
