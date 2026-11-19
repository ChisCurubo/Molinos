import { Router } from 'express';
import { factory } from '../../config/factory';

import { upComprobante } from '../../helpers/upload.middleware';
import { validarDinero } from '../../helpers/validar.middleware';
const router = Router();

// Init CxP
const cxpController = factory.pagos.getCuentasPorPagarController();
const categoriaCxpController = factory.pagos.getCategoriaCxPController();

// Rutas CxP Custom
router.get('/mensual', cxpController.listarMensual.bind(cxpController));
router.post('/', cxpController.registrar.bind(cxpController));
router.get('/', cxpController.listar.bind(cxpController));
router.post('/:id/abonos', upComprobante, validarDinero, cxpController.abonar.bind(cxpController));
router.post('/:id/pagar', cxpController.pagar.bind(cxpController));

// CxP Categorias
router.get('/categorias', categoriaCxpController.list);
router.get('/categorias/:id', categoriaCxpController.getById);
router.post('/categorias', categoriaCxpController.create);
router.put('/categorias/:id', categoriaCxpController.update);
router.delete('/categorias/:id', categoriaCxpController.delete);

export default router;
