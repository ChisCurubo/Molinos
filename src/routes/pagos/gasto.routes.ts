import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const tipoGastoController = factory.pagos.getTipoGastoOperativoController();

// Gastos Operativos
router.get('/tipos', tipoGastoController.list);
router.get('/tipos/:id', tipoGastoController.getById);
router.post('/tipos', tipoGastoController.create);
router.put('/tipos/:id', tipoGastoController.update);
router.delete('/tipos/:id', tipoGastoController.delete);

export default router;
