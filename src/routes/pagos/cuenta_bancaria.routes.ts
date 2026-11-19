import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const controller = factory.pagos.getCuentaBancariaController();

router.get('/saldos', controller.listarSaldos);
router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.patch('/:id', controller.update);
router.delete('/:id', controller.delete);
router.get('/:id/saldo', controller.getSaldo);

export default router;
