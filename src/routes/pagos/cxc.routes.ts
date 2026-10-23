import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const categoriaCxcController = factory.pagos.getCategoriaCxCController();
const cuentasPorCobrarController = factory.pagos.getCuentasPorCobrarController();

// Cuentas por cobrar (mes a mes, paginado)
router.get('/mensual', cuentasPorCobrarController.listarMensual);

// CxC Categorias (deben ir antes de /:id, para que "categorias" no se interprete como un id)
router.get('/categorias', categoriaCxcController.list);
router.get('/categorias/:id', categoriaCxcController.getById);
router.post('/categorias', categoriaCxcController.create);
router.put('/categorias/:id', categoriaCxcController.update);
router.delete('/categorias/:id', categoriaCxcController.delete);

// Cuentas por cobrar: crear (sin abono, o con abono inicial incluido) + cobrar después
router.post('/', cuentasPorCobrarController.crear);
router.get('/:id', cuentasPorCobrarController.obtenerPorId);
router.post('/:id/abonos', cuentasPorCobrarController.abonar);
router.patch('/:id', cuentasPorCobrarController.editar);
router.delete('/:id', cuentasPorCobrarController.anular);

export default router;
