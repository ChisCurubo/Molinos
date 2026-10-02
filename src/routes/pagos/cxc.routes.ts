import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const categoriaCxcController = factory.pagos.getCategoriaCxCController();
const cuentasPorCobrarController = factory.pagos.getCuentasPorCobrarController();

// Cuentas por cobrar (mes a mes, paginado)
router.get('/mensual', cuentasPorCobrarController.listarMensual);

// CxC Categorias
router.get('/categorias', categoriaCxcController.list);
router.get('/categorias/:id', categoriaCxcController.getById);
router.post('/categorias', categoriaCxcController.create);
router.put('/categorias/:id', categoriaCxcController.update);
router.delete('/categorias/:id', categoriaCxcController.delete);

export default router;
