import { Router } from 'express';
import { TipoGastoOperativoController } from '../../controllers/pagos/gasto.controller';

const router = Router();
const tipoGastoController = new TipoGastoOperativoController();

// Gastos Operativos
router.get('/tipos', tipoGastoController.list);
router.get('/tipos/:id', tipoGastoController.getById);
router.post('/tipos', tipoGastoController.create);
router.put('/tipos/:id', tipoGastoController.update);
router.delete('/tipos/:id', tipoGastoController.delete);

export default router;
