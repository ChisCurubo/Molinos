import { Router } from 'express';
import { factory } from '../../config/factory';

const router = Router();
const categoriaCxcController = factory.pagos.getCategoriaCxCController();

// CxC Categorias
router.get('/categorias', categoriaCxcController.list);
router.get('/categorias/:id', categoriaCxcController.getById);
router.post('/categorias', categoriaCxcController.create);
router.put('/categorias/:id', categoriaCxcController.update);
router.delete('/categorias/:id', categoriaCxcController.delete);

export default router;
