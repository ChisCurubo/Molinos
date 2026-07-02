import { Router } from 'express';
import { CategoriaCxCController } from '../../controllers/pagos/cxc.controller';

const router = Router();
const categoriaCxcController = new CategoriaCxCController();

// CxC Categorias
router.get('/categorias', categoriaCxcController.list);
router.get('/categorias/:id', categoriaCxcController.getById);
router.post('/categorias', categoriaCxcController.create);
router.put('/categorias/:id', categoriaCxcController.update);
router.delete('/categorias/:id', categoriaCxcController.delete);

export default router;
