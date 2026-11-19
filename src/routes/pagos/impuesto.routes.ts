import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.pagos.getImpuestoController();

router.get('/', controller.list);
router.get('/aplicados', controller.listarAplicados);

export default router;
