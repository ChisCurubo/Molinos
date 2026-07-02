import { Router } from 'express';
import { CuentasPorPagarController, CategoriaCxPController } from '../../controllers/pagos/cxp.controller';
import { MySQLCuentasPorPagarRepo } from '../../repositories/pagos/cxp.repository';
import { CuentasPorPagarService } from '../../services/pagos/cxp.service';

const router = Router();

// Init CxP
const repo = new MySQLCuentasPorPagarRepo();
const service = new CuentasPorPagarService(repo);
const cxpController = new CuentasPorPagarController(service);
const categoriaCxpController = new CategoriaCxPController();

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
