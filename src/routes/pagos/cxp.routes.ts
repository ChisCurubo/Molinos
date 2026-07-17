import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();

// Init CxP
const cxpController = factory.pagos.getCuentasPorPagarController();
const categoriaCxpController = factory.pagos.getCategoriaCxPController();

// Rutas CxP Custom
router.post('/', cxpController.registrar.bind(cxpController));
router.get('/', cxpController.listar.bind(cxpController));
router.post('/:id/pagar', cxpController.pagar.bind(cxpController));

// CxP Categorias
router.get('/categorias', categoriaCxpController.list);
router.get('/categorias/:id', categoriaCxpController.getById);
router.post('/categorias', categoriaCxpController.create);
router.put('/categorias/:id', categoriaCxpController.update);
router.delete('/categorias/:id', categoriaCxpController.delete);

export default router;
